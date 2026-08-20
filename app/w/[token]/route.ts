import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWishlistByShareToken, recordEvent, rememberKey } from "@/lib/queries";

/**
 * Share links are short and opaque. Opening one grants this browser access to a
 * link-only list, then sends the visitor on to the list's real address.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const list = getWishlistByShareToken(token);
  if (!list) return NextResponse.redirect(new URL("/", _request.url));

  const owner = db
    .prepare(`SELECT username FROM profiles WHERE user_id = ?`)
    .get(list.userId) as { username: string } | undefined;
  if (!owner) return NextResponse.redirect(new URL("/", _request.url));

  await rememberKey(list.shareToken);
  recordEvent(list.id, "share");

  return NextResponse.redirect(new URL(`/${owner.username}/${list.slug}`, _request.url));
}
