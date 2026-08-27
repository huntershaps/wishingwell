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
