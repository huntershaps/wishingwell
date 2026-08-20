/**
 * Builds the short vertical clips used by the demo's video items, plus a poster
 * frame for each. Filmed-by-hand feel comes from a slow drift and a touch of
 * sway rather than a hard Ken Burns zoom, which reads as a slideshow.
 *
 *   node scripts/make-videos.mjs
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const run = promisify(execFile);
const MEDIA = path.join(process.cwd(), "public", "media");

const CLIPS = [
  { key: "note-camera", from: "sony-a7", seconds: 9, drift: 34 },
  { key: "note-turntable", from: "turntable-alt", seconds: 9, drift: 26 },
  { key: "note-ryokan", from: "ryokan", seconds: 8, drift: 30 },
];

const W = 720;
const H = 1280;

async function build({ key, from, seconds, drift }) {
  const src = path.join(MEDIA, `${from}.jpg`);
  const out = path.join(MEDIA, `${key}.mp4`);
  const poster = path.join(MEDIA, `${key}.jpg`);

  // Scale so the frame is comfortably larger than the crop window, then move
  // the window: a slow vertical drift with a shallow horizontal sway.
  const filter = [
    `scale=-2:${Math.round(H * 1.35)}`,
    `crop=${W}:${H}:x='(in_w-${W})/2+${drift}*sin(t/2.6)':y='(in_h-${H})/2+${drift * 0.9}*sin(t/3.4+1)'`,
    `eq=saturation=1.03:contrast=1.02`,
    `vignette=PI/5`,
    `fps=30`,
  ].join(",");

  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-loop", "1", "-i", src,
    "-t", String(seconds),
    "-vf", filter,
    "-c:v", "libx264", "-crf", "26", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
    out,
  ]);

  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", out, "-ss", "0.6", "-frames:v", "1", "-q:v", "4",
    poster,
  ]);

  const { size } = await fs.stat(out);
  process.stdout.write(`✓ ${key}.mp4 — ${(size / 1024).toFixed(0)}kb\n`);
}

for (const clip of CLIPS) await build(clip);
