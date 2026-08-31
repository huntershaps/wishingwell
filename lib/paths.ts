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
 * The Vercel Blob credential, when there is one to find.
 *
 * A store connected the old way exports BLOB_READ_WRITE_TOKEN, and a store that
 * is not the project default exports it under its own prefix, which the SDK
 * would never look for. Either is passed to `put()` explicitly.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const match = Object.entries(process.env).find(
    ([key, value]) => key.endsWith("BLOB_READ_WRITE_TOKEN") && value,
  );
  return match?.[1];
}

/**
 * Whether uploads can go to Vercel Blob.
 *
 * A store connected today exports no read-write token at all: it exports
 * BLOB_STORE_ID, and the SDK authenticates with the deployment's own OIDC
 * identity. Requiring a token here is what made a correctly connected store look
 * absent and sent uploads to a disk that does not exist.
 */
export function hasVercelBlob(): boolean {
  return Boolean(blobToken() || process.env.BLOB_STORE_ID);
}

/** Where an upload would be written, for logs and the health check. */
export function destination(): string {
  if (hasVercelBlob()) return blobToken() ? "vercel-blob (token)" : "vercel-blob (oidc)";
  if (process.env.NETLIFY) return "netlify-blobs";
  return "disk";
}
