import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Readiness for the platform's health check: the server is up and the database
 * answers.
 *
 * When it does not answer, this says enough to tell the three usual causes
 * apart — no credentials configured, wrong credentials, database unreachable —
 * without disclosing any of them. The token is reported as present or absent
 * and never echoed, and the URL only as its host.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const rawToken = process.env.TURSO_AUTH_TOKEN;
  const configured = {
    databaseUrl: url ? new URL(url.replace(/^libsql:/, "https:")).host : "missing",
    authToken: rawToken ? "set" : "missing",
    // A hash prefix, so a token that arrived truncated, quoted or with a stray
    // newline can be told apart from the working one without either being shown.
    tokenFingerprint: rawToken
      ? createHash("sha256").update(rawToken).digest("hex").slice(0, 12)
      : null,
    tokenLength: rawToken?.length ?? 0,
    // Where uploads go. Without one of these on a serverless host there is no
    // disk to fall back to, and adding a photo fails while everything else works.
    uploads: process.env.BLOB_READ_WRITE_TOKEN
      ? "vercel-blob"
      : process.env.NETLIFY
        ? "netlify-blobs"
        : "disk",
  };

  try {
    await db.prepare(`SELECT 1`).get();
    return Response.json({ ok: true, ...configured });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return Response.json(
      {
        ok: false,
        ...configured,
        // Codes and class names only; a message could carry the URL.
        error: e?.code ?? (err as Error)?.name ?? "unknown",
        cause: (err as { cause?: { status?: number } })?.cause?.status ?? null,
      },
      { status: 503 },
    );
  }
}
