import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWishlistByShareToken, recordEvent, rememberKey } from "@/lib/queries";

/**
 * Share links are short and opaque. Opening one grants this browser access to a
 * link-only list, then sends the visitor on to the list's real address.
 *
 * The redirects are relative on purpose. Behind a proxy the server only knows
 * the address it is bound to inside its container, so anything built from
 * `request.url` sends visitors to https://0.0.0.0:3000 — and a share link that
 * strands the person following it is the one link that cannot afford to break.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const list = getWishlistByShareToken(token);
  if (!list) redirect("/");

  const owner = db
    .prepare(`SELECT username FROM profiles WHERE user_id = ?`)
    .get(list.userId) as { username: string } | undefined;
  if (!owner) redirect("/");

  await rememberKey(list.shareToken);
  recordEvent(list.id, "share");

  redirect(`/${owner.username}/${list.slug}`);
}
