/**
 * Container entrypoint.
 *
 * The image is thrown away on every deploy; the volume is not. So the first
 * time a volume is seen it gets the demo world copied onto it from the template
 * database baked into the image at build time, and after that the volume is
 * left alone — the live database is the source of truth, real accounts and all.
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.WISHWELL_DATA_DIR ?? "/data";
const uploadDir = process.env.WISHWELL_UPLOAD_DIR ?? path.join(dataDir, "uploads");
const template = process.env.WISHWELL_SEED_DB ?? "/app/seed/wishwell.db";
const live = path.join(dataDir, "wishwell.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

if (fs.existsSync(live)) {
  console.log(`[wishwell] using the database already on the volume at ${live}`);
} else if (fs.existsSync(template)) {
  fs.copyFileSync(template, live);
  console.log(`[wishwell] empty volume, so ${live} starts as a copy of the demo`);
} else {
  console.log(`[wishwell] no database and no template: starting empty at ${live}`);
}

await import("../server.js");
