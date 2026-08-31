import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { UPLOAD_DIR, blobToken, hasVercelBlob } from "@/lib/paths";

/**
 * Serves the photographs and video notes people upload.
 *
 * Deployed, they live in object storage, because a serverless function has no
 * disk that outlives the request: Vercel Blob on Vercel, Netlify Blobs on
 * Netlify. Locally, and in the container build, they are files next to the
 * database. All three are served from the same /uploads/<name> path, so an
 * item's stored URL is correct wherever it was created.
 *
 * Byte ranges are the reason this does more than read a file: without them
 * Safari refuses to play video, and scrubbing re-downloads the whole clip.
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
// Anything else is not a file we wrote, so it is a 404 before it touches storage.
const NAME = /^[A-Za-z0-9_-]+\.([A-Za-z0-9]+)$/;

/** Parses a single-range request against a known size. */
function parseRange(header: string | null, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd));
  const end = rawStart ? (rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1) : size - 1;
  if (!Number.isFinite(start) || start > end || start >= size) return { invalid: true as const };
  return { start, end };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params;
  if (file.length !== 1) return new Response("Not found", { status: 404 });

  const match = NAME.exec(file[0]);
  const type = match && TYPES[match[1].toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    // The name carries a random token and the bytes never change under it.
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  if (hasVercelBlob()) {
    const explicitToken = blobToken();
    const { get } = await import("@vercel/blob");
    const found = await get(`uploads/${file[0]}`, {
      access: "private",
      ...(explicitToken ? { token: explicitToken } : {}),
    });
    if (!found) return new Response("Not found", { status: 404 });

    const body = new Uint8Array(await new Response(found.stream).arrayBuffer());
    const range = parseRange(request.headers.get("range"), body.byteLength);
    if (range && "invalid" in range) {
      headers.set("Content-Range", `bytes */${body.byteLength}`);
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      const slice = body.subarray(range.start, range.end + 1);
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${body.byteLength}`);
      headers.set("Content-Length", String(slice.byteLength));
      return new Response(slice, { status: 206, headers });
    }
    headers.set("Content-Length", String(body.byteLength));
    return new Response(body, { headers });
  }

  if (process.env.NETLIFY) {
    const { getStore } = await import("@netlify/blobs");
    const blob = await getStore("uploads").get(file[0], { type: "arrayBuffer" });
    if (!blob) return new Response("Not found", { status: 404 });

    const body = new Uint8Array(blob);
    const range = parseRange(request.headers.get("range"), body.byteLength);
    if (range && "invalid" in range) {
      headers.set("Content-Range", `bytes */${body.byteLength}`);
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      const slice = body.subarray(range.start, range.end + 1);
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${body.byteLength}`);
      headers.set("Content-Length", String(slice.byteLength));
      return new Response(slice, { status: 206, headers });
    }
    headers.set("Content-Length", String(body.byteLength));
    return new Response(body, { headers });
  }

  const full = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file[0]);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const range = parseRange(request.headers.get("range"), stat.size);
  if (range && "invalid" in range) {
    headers.set("Content-Range", `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    const stream = Readable.toWeb(
      fs.createReadStream(full, { start: range.start, end: range.end }),
    ) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(stat.size));
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream<Uint8Array>;
  return new Response(stream, { headers });
}
