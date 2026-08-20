/**
 * Pins one media key to a specific Unsplash photo, for the cases where search
 * cannot be trusted to return the right thing — a watch that is actually the
 * brand the item names, a lens that is actually that lens.
 *
 *   node scripts/set-photo.mjs <key> <photoId>
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const OUT = path.join(process.cwd(), "public", "media");
const CREDITS = path.join(OUT, "credits.json");

const [key, photoId] = process.argv.slice(2);
if (!key || !photoId) {
  process.stderr.write("usage: node scripts/set-photo.mjs <key> <photoId>\n");
  process.exit(1);
}

const res = await fetch(`https://unsplash.com/napi/photos/${photoId}`, {
  headers: { Accept: "application/json", "User-Agent": "wishwell-demo-seed" },
});
if (!res.ok) {
  process.stderr.write(`lookup failed: ${res.status}\n`);
  process.exit(1);
}
const photo = await res.json();
if (photo.plus || photo.premium) {
  process.stderr.write("that photo is Unsplash+ and would come back watermarked\n");
  process.exit(1);
}

const image = await fetch(`${photo.urls.raw}&w=1600&q=78&fm=jpg&fit=max`);
const buf = Buffer.from(await image.arrayBuffer());
await fs.writeFile(path.join(OUT, `${key}.jpg`), buf);

const tmp = path.join(OUT, `.${key}.blur.jpg`);
await run("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", path.join(OUT, `${key}.jpg`),
  "-vf", "scale=20:-1", "-q:v", "12", tmp,
]);
const blur = `data:image/jpeg;base64,${(await fs.readFile(tmp)).toString("base64")}`;
await fs.unlink(tmp);

const credits = JSON.parse(await fs.readFile(CREDITS, "utf8"));
credits[key] = {
  query: `pinned:${photoId}`,
  id: photo.id,
  alt: photo.alt_description ?? photo.description ?? key,
  photographer: photo.user?.name ?? "Unknown",
  photographerUrl: photo.user?.links?.html ?? null,
  link: photo.links?.html ?? null,
  width: photo.width,
  height: photo.height,
  ratio: +(photo.width / photo.height).toFixed(4),
  plus: false,
  blur,
};
await fs.writeFile(CREDITS, JSON.stringify(credits, null, 2));

process.stdout.write(
  `✓ ${key} ← ${photoId} — ${(buf.length / 1024).toFixed(0)}kb — ${credits[key].photographer}\n`,
);
