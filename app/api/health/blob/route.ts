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

export async function GET(request: Request) {
  if (!(await getCurrentUser())) {
    return Response.json({ error: "sign in first" }, { status: 401 });
  }

  // ?pathname=uploads/xyz.png inspects something already stored.
  const inspect = new URL(request.url).searchParams.get("pathname");
  if (inspect) {
    const { head } = await import("@vercel/blob");
    const explicit = blobToken();
    try {
      const meta = await head(inspect, explicit ? { token: explicit } : {});
      return Response.json({ pathname: meta.pathname, size: meta.size, contentType: meta.contentType });
    } catch (err) {
      return Response.json({ error: String((err as Error).message).slice(0, 200) }, { status: 404 });
    }
  }

  const where = destination();
  if (!hasVercelBlob()) {
    return Response.json({ ok: false, destination: where, reason: "no blob store configured" });
  }

  try {
    const { put, del } = await import("@vercel/blob");
    const explicitToken = blobToken();
    // Binary, sent as a File, which is what an upload actually is.
    const payload = new Uint8Array(Array.from({ length: 70 }, (_, i) => i));
    const blob = await put(
      `health/probe-${Date.now()}.bin`,
      new File([payload], "probe.bin", { type: "application/octet-stream" }),
      {
        access: "private",
        contentType: "application/octet-stream",
        ...(explicitToken ? { token: explicitToken } : {}),
      },
    );
    const { get } = await import("@vercel/blob");
    const found = await get(blob.pathname, {
      access: "private",
      ...(explicitToken ? { token: explicitToken } : {}),
    });
    const bytes = found?.stream ? new Uint8Array(await new Response(found.stream).arrayBuffer()) : null;
    const { head } = await import("@vercel/blob");
    const meta = await head(blob.pathname, explicitToken ? { token: explicitToken } : {});
    await del(blob.url, explicitToken ? { token: explicitToken } : undefined);
    return Response.json({
      ok: true,
      destination: where,
      sent: payload.byteLength,
      storedSize: meta.size,
      readBack: bytes?.byteLength ?? null,
      getStatus: found?.statusCode ?? null,
    });
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
