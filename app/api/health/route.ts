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
  const configured = {
    databaseUrl: url ? new URL(url.replace(/^libsql:/, "https:")).host : "missing",
    authToken: process.env.TURSO_AUTH_TOKEN ? "set" : "missing",
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
