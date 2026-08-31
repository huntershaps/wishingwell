import { db } from "@/lib/db";
import { destination } from "@/lib/paths";

/**
 * Readiness: the server is up, the database answers, and uploads have somewhere
 * to go.
 *
 * Deliberately says little. During the first deploy this reported the database
 * host, a fingerprint of the auth token and the names of every blob-related
 * variable, which is how a 52-character token pretending to be a 348-character
 * one was found — but that is a debugging posture, not one to leave facing the
 * internet.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.prepare(`SELECT 1`).get();
    return Response.json({ ok: true, uploads: destination() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
