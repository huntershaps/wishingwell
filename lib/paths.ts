import path from "node:path";

/**
 * Where the two things that outlive a deploy live.
 *
 * In development both sit inside the project: the database in .data, uploads in
 * public/uploads, where Next serves them statically. In a container both point
 * at the mounted volume instead, because the image itself is replaced on every
 * deploy — see app/uploads/[...file]/route.ts for how uploads are served then.
 */
export const DATA_DIR =
  process.env.WISHWELL_DATA_DIR ?? path.join(process.cwd(), ".data");

export const UPLOAD_DIR =
  process.env.WISHWELL_UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");

/**
 * The Vercel Blob credential.
 *
 * `put()` reads BLOB_READ_WRITE_TOKEN by itself, but Vercel only uses that exact
 * name for a project's default store; any other store arrives prefixed with the
 * store's name, and the SDK never sees it. So find it by suffix and pass it in.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const match = Object.entries(process.env).find(
    ([key, value]) => key.endsWith("BLOB_READ_WRITE_TOKEN") && value,
  );
  return match?.[1];
}
