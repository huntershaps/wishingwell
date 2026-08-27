import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { UPLOAD_DIR } from "@/lib/paths";

/**
 * Serves the photographs and video notes people upload.
 *
 * In development these sit in public/uploads and Next serves them itself, so
 * this route is redundant there. In a container they live on the mounted
 * volume, outside the image entirely, and nothing else would hand them out.
 *
 * Videos are the reason this bothers with byte ranges: without them Safari
 * refuses to play, and scrubbing anywhere in a clip re-downloads the whole file.
 */
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

// Upload names are a base64url token and an extension this app chose itself.
// Anything else is not a file we wrote, so it is a 404 before it touches disk.
const NAME = /^[A-Za-z0-9_-]+\.([A-Za-z0-9]+)$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params;
  if (file.length !== 1) return new Response("Not found", { status: 404 });

  const match = NAME.exec(file[0]);
  const type = match && TYPES[match[1].toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  const full = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file[0]);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    // The name contains a random token and the bytes never change under it.
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const [, rawStart, rawEnd] = range;
    const start = rawStart ? Number(rawStart) : Math.max(0, stat.size - Number(rawEnd));
    const end = rawStart ? (rawEnd ? Math.min(Number(rawEnd), stat.size - 1) : stat.size - 1) : stat.size - 1;
    if (!Number.isFinite(start) || start > end || start >= stat.size) {
      headers.set("Content-Range", `bytes */${stat.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(
      fs.createReadStream(full, { start, end }),
    ) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(stat.size));
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream<Uint8Array>;
  return new Response(stream, { headers });
}
