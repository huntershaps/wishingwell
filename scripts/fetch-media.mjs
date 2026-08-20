/**
 * Downloads the demo photography once and keeps it in public/media, so the app
 * renders identically offline and nothing depends on a third-party CDN staying
 * up. Also records photographer credit and a tiny blur placeholder per image.
 *
 *   node scripts/fetch-media.mjs [key ...]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PHOTOS } from "./media-manifest.mjs";

const run = promisify(execFile);
const OUT = path.join(process.cwd(), "public", "media");
const CREDITS = path.join(OUT, "credits.json");
const only = process.argv.slice(2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(query, orientation) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(
    query,
  )}&per_page=8&orientation=${orientation}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "wishwell-demo-seed" },
  });
  if (!res.ok) throw new Error(`search ${query}: ${res.status}`);
  const json = await res.json();
  // Unsplash+ results come back with a watermark burned into the preview, which
  // looks exactly as unfinished as it sounds. Drop them.
  return (json.results ?? []).filter((p) => !p.plus && !p.premium);
}

async function lookup(id) {
  const res = await fetch(`https://unsplash.com/napi/photos/${id}`, {
    headers: { Accept: "application/json", "User-Agent": "wishwell-demo-seed" },
  });
  if (!res.ok) throw new Error(`lookup ${id}: ${res.status}`);
  return res.json();
}

async function download(photo, key) {
  const width = 1600;
  const src = `${photo.urls.raw}&w=${width}&q=78&fm=jpg&fit=max`;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`download ${key}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(OUT, `${key}.jpg`), buf);
  return buf.length;
}

/** 20px wide JPEG, inlined as a data URI, for the blur-up placeholder. */
async function blurPlaceholder(key) {
  const src = path.join(OUT, `${key}.jpg`);
  const tmp = path.join(OUT, `.${key}.blur.jpg`);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=20:-1", "-q:v", "12", tmp]);
  const buf = await fs.readFile(tmp);
  await fs.unlink(tmp);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  let credits = {};
  try {
    credits = JSON.parse(await fs.readFile(CREDITS, "utf8"));
  } catch {}

  const targets = only.length ? PHOTOS.filter((p) => only.includes(p.key)) : PHOTOS;

  for (const entry of targets) {
    const dest = path.join(OUT, `${entry.key}.jpg`);
    const exists = await fs
      .stat(dest)
      .then(() => true)
      .catch(() => false);
    if (exists && credits[entry.key] && !only.length) {
      process.stdout.write(`· ${entry.key} (cached)\n`);
      continue;
    }
    try {
      let pick;
      if (entry.pin) {
        pick = await lookup(entry.pin);
      } else {
        const results = await search(entry.q, entry.o);
        pick = results[entry.pick ?? 0];
      }
      if (!pick) throw new Error("no results");
      const bytes = await download(pick, entry.key);
      credits[entry.key] = {
        query: entry.q,
        id: pick.id,
        alt: pick.alt_description ?? pick.description ?? entry.q,
        photographer: pick.user?.name ?? "Unknown",
        photographerUrl: pick.user?.links?.html ?? null,
        link: pick.links?.html ?? null,
        width: pick.width,
        height: pick.height,
        ratio: +(pick.width / pick.height).toFixed(4),
        plus: !!pick.plus,
        blur: await blurPlaceholder(entry.key),
      };
      process.stdout.write(`✓ ${entry.key} — ${(bytes / 1024).toFixed(0)}kb — ${credits[entry.key].photographer}\n`);
      await fs.writeFile(CREDITS, JSON.stringify(credits, null, 2));
      await sleep(350);
    } catch (err) {
      process.stdout.write(`✗ ${entry.key}: ${err.message}\n`);
    }
  }

  await fs.writeFile(CREDITS, JSON.stringify(credits, null, 2));
  process.stdout.write(`\n${Object.keys(credits).length} photographs in public/media\n`);
}

main();
