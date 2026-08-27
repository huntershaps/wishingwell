import { db } from "@/lib/db";

/** Readiness for the platform's health check: the server is up and the database answers. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    db.prepare(`SELECT 1`).get();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
