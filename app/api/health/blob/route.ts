import { getCurrentUser } from "@/lib/auth";
import { blobToken, destination, hasVercelBlob } from "@/lib/paths";

/**
 * Writes a tiny object to blob storage and deletes it again, so a broken upload
 * path can be diagnosed without uploading a real photograph and without reading
 * the platform's logs.
 *
 * Signed-in only: it performs a write, and its error messages describe the
 * storage configuration.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentUser())) {
    return Response.json({ error: "sign in first" }, { status: 401 });
  }

  const where = destination();
  if (!hasVercelBlob()) {
    return Response.json({ ok: false, destination: where, reason: "no blob store configured" });
  }

  try {
    const { put, del } = await import("@vercel/blob");
    const explicitToken = blobToken();
    const blob = await put(`health/probe-${Date.now()}.txt`, "probe", {
      access: "private",
      contentType: "text/plain",
      ...(explicitToken ? { token: explicitToken } : {}),
    });
    const { get } = await import("@vercel/blob");
    const found = await get(blob.pathname, {
      access: "private",
      ...(explicitToken ? { token: explicitToken } : {}),
    });
    const readback = found ? (await new Response(found.stream).text()) : "(not found)";
    await del(blob.url, explicitToken ? { token: explicitToken } : undefined);
    return Response.json({ ok: true, destination: where, pathname: blob.pathname, readback });
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    return Response.json(
      {
        ok: false,
        destination: where,
        name: e?.name ?? "unknown",
        code: e?.code ?? null,
        status: e?.status ?? null,
        message: String(e?.message ?? "").slice(0, 300),
      },
      { status: 500 },
    );
  }
}
