import "server-only";
import { cookies } from "next/headers";
import { db, id, now } from "./db";
import { mapProfile } from "./auth";
import { runReservationMaintenance } from "./reservations";
import type { GiftState, Item, Media, Profile, Viewer, Wishlist } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const KEYS_COOKIE = "ww_keys";

/** Share tokens this browser has redeemed, granting access to link-only lists. */
export async function redeemedKeys(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(KEYS_COOKIE)?.value;
  return raw ? raw.split(".").filter(Boolean) : [];
}

export async function rememberKey(shareToken: string) {
  const jar = await cookies();
  const keys = new Set(await redeemedKeys());
  keys.add(shareToken);
  jar.set(KEYS_COOKIE, [...keys].slice(-25).join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// --------------------------------------------------------------- wishlists

function mapWishlist(row: any): Wishlist {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    icon: row.icon,
    coverUrl: row.cover_url,
    accent: row.accent,
    occasion: row.occasion,
    eventDate: row.event_date,
    visibility: row.visibility,
    shareToken: row.share_token,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: row.itemCount ?? 0,
  };
}

const WISHLIST_SELECT = `
  SELECT w.*,
         (SELECT COUNT(*) FROM items i WHERE i.wishlist_id = w.id AND i.archived_at IS NULL) AS itemCount
    FROM wishlists w`;

export async function getOwnerWishlists(userId: string): Promise<Wishlist[]> {
  const rows = await db
    .prepare(`${WISHLIST_SELECT} WHERE w.user_id = ? ORDER BY w.position, w.created_at DESC`)
    .all(userId) as any[];
  return rows.map(mapWishlist);
}

export async function getWishlistBySlug(username: string, slug: string): Promise<Wishlist | null> {
  const row = await db
    .prepare(
      `${WISHLIST_SELECT}
       JOIN profiles p ON p.user_id = w.user_id
       WHERE p.username = ? AND w.slug = ?`,
    )
    .get(username, slug) as any;
  return row ? mapWishlist(row) : null;
}

export async function getWishlistByShareToken(shareToken: string): Promise<Wishlist | null> {
  const row = await db.prepare(`${WISHLIST_SELECT} WHERE w.share_token = ?`).get(shareToken) as any;
  return row ? mapWishlist(row) : null;
}

export async function getWishlistById(wishlistId: string): Promise<Wishlist | null> {
  const row = await db.prepare(`${WISHLIST_SELECT} WHERE w.id = ?`).get(wishlistId) as any;
  return row ? mapWishlist(row) : null;
}

export type Access =
  | { allowed: true; isOwner: boolean }
  | { allowed: false; isOwner: false; reason: "private" | "link_required" };

export async function checkAccess(list: Wishlist, viewer: Viewer): Promise<Access> {
  if (viewer.userId && viewer.userId === list.userId) return { allowed: true, isOwner: true };
  if (list.visibility === "public") return { allowed: true, isOwner: false };
  if (list.visibility === "link") {
    const keys = await redeemedKeys();
    return keys.includes(list.shareToken)
      ? { allowed: true, isOwner: false }
      : { allowed: false, isOwner: false, reason: "link_required" };
  }
  return { allowed: false, isOwner: false, reason: "private" };
}

// ------------------------------------------------------------------- items

function mapMedia(row: any): Media {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind,
    url: row.url,
    posterUrl: row.poster_url,
    alt: row.alt,
    caption: row.caption,
    width: row.width,
    height: row.height,
    position: row.position,
  };
}

type ActiveReservation = {
  id: string;
  item_id: string;
  status: "reserved" | "purchased";
  buyer_user_id: string | null;
  guest_token: string | null;
  reserved_at: number;
  expires_at: number | null;
  purchased_at: number | null;
  note: string | null;
};

/**
 * Resolves what a given viewer is allowed to know about an item.
 *
 * This is the single place surprise mode is enforced. Owner-facing callers get
 * `hidden` while surprise mode is on, so no route, component, or serialised
 * payload downstream ever carries the answer.
 */
function resolveGiftState(
  active: ActiveReservation | undefined,
  opts: { isOwner: boolean; surpriseMode: boolean; viewer: Viewer },
): { giftState: GiftState; reservedByViewer: boolean; reservation?: Item["reservation"] } {
  if (opts.isOwner) {
    if (opts.surpriseMode) return { giftState: "hidden", reservedByViewer: false };
    return {
      giftState: active ? (active.status === "purchased" ? "purchased" : "reserved") : "available",
      reservedByViewer: false,
    };
  }
  if (!active) return { giftState: "available", reservedByViewer: false };
  const mine =
    (!!opts.viewer.userId && active.buyer_user_id === opts.viewer.userId) ||
    (!!opts.viewer.guestToken && active.guest_token === opts.viewer.guestToken);
  return {
    giftState: active.status === "purchased" ? "purchased" : "reserved",
    reservedByViewer: mine,
    reservation: mine
      ? {
          id: active.id,
          status: active.status,
          reservedAt: active.reserved_at,
          expiresAt: active.expires_at,
          purchasedAt: active.purchased_at,
          note: active.note,
        }
      : undefined,
  };
}

export async function getItems(
  wishlistId: string,
  opts: { viewer: Viewer; isOwner: boolean; surpriseMode: boolean },
): Promise<Item[]> {
  await runReservationMaintenance();

  const rows = await db
    .prepare(
      `SELECT * FROM items WHERE wishlist_id = ? AND archived_at IS NULL
        ORDER BY position, created_at DESC`,
    )
    .all(wishlistId) as any[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => "?").join(",");
  const media = await db
    .prepare(`SELECT * FROM item_media WHERE item_id IN (${marks}) ORDER BY position`)
    .all(...ids) as any[];
  const actives = await db
    .prepare(
      `SELECT * FROM reservations
        WHERE item_id IN (${marks}) AND status IN ('reserved','purchased')`,
    )
    .all(...ids) as ActiveReservation[];

  const mediaByItem = new Map<string, Media[]>();
  for (const m of media) {
    const list = mediaByItem.get(m.item_id) ?? [];
    list.push(mapMedia(m));
    mediaByItem.set(m.item_id, list);
  }
  const activeByItem = new Map(actives.map((a) => [a.item_id, a]));

  return rows.map((r) => {
    const resolved = resolveGiftState(activeByItem.get(r.id), opts);
    return {
      id: r.id,
      wishlistId: r.wishlist_id,
      name: r.name,
      url: r.url,
      store: r.store,
      priceCents: r.price_cents,
      currency: r.currency,
      description: r.description,
      whyWant: r.why_want,
      priority: r.priority,
      category: r.category,
      tags: JSON.parse(r.tags || "[]"),
      notes: r.notes,
      size: r.size,
      color: r.color,
      variant: r.variant,
      feature: !!r.feature,
      position: r.position,
      createdAt: r.created_at,
      media: mediaByItem.get(r.id) ?? [],
      ...resolved,
    } satisfies Item;
  });
}

export async function getItemRaw(itemId: string) {
  return await db.prepare(`SELECT * FROM items WHERE id = ?`).get(itemId) as any;
}

// ---------------------------------------------------------------- profiles

export async function getPublicProfile(username: string): Promise<Profile | null> {
  const row = await db.prepare(`SELECT * FROM profiles WHERE username = ?`).get(username) as any;
  return row ? mapProfile(row) : null;
}

export async function getVisibleWishlists(ownerId: string, viewer: Viewer): Promise<Wishlist[]> {
  const isOwner = viewer.userId === ownerId;
  const rows = await db
    .prepare(
      `${WISHLIST_SELECT}
        WHERE w.user_id = ? AND w.archived_at IS NULL
          ${isOwner ? "" : "AND w.visibility = 'public'"}
        ORDER BY w.position, w.created_at DESC`,
    )
    .all(ownerId) as any[];
  return rows.map(mapWishlist);
}

/** The soonest list with a date still ahead of it, if there is one. */
export function nextEvent(lists: Wishlist[]): Wishlist | undefined {
  const from = Date.now();
  return lists
    .filter((l) => l.eventDate && l.eventDate > from)
    .sort((a, b) => (a.eventDate ?? 0) - (b.eventDate ?? 0))[0];
}

// --------------------------------------------------------------- analytics

export async function recordEvent(wishlistId: string, kind: "view" | "share") {
  await db.prepare(
    `INSERT INTO wishlist_events (id, wishlist_id, kind, created_at) VALUES (?, ?, ?, ?)`,
  ).run(id(), wishlistId, kind, now());
}

export type ListStats = {
  views: number;
  shares: number;
  itemCount: number;
  availableCount: number;
  giftActivityCount: number;
};

/**
 * Owner-side numbers. Gift activity is a count and nothing more: enough to know
 * something is happening, not enough to work out what.
 */
export async function getListStats(wishlistId: string): Promise<ListStats> {
  const counts = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM wishlist_events e WHERE e.wishlist_id = ? AND e.kind = 'view') AS views,
         (SELECT COUNT(*) FROM wishlist_events e WHERE e.wishlist_id = ? AND e.kind = 'share') AS shares,
         (SELECT COUNT(*) FROM items i WHERE i.wishlist_id = ? AND i.archived_at IS NULL) AS itemCount,
         (SELECT COUNT(*) FROM items i
            WHERE i.wishlist_id = ? AND i.archived_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM reservations r
                               WHERE r.item_id = i.id AND r.status IN ('reserved','purchased'))
         ) AS availableCount`,
    )
    .get(wishlistId, wishlistId, wishlistId, wishlistId) as any;
  return {
    views: counts.views,
    shares: counts.shares,
    itemCount: counts.itemCount,
    availableCount: counts.availableCount,
    giftActivityCount: counts.itemCount - counts.availableCount,
  };
}

export async function getOwnerOverview(userId: string) {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM wishlists w WHERE w.user_id = ? AND w.archived_at IS NULL) AS lists,
         (SELECT COUNT(*) FROM items i JOIN wishlists w ON w.id = i.wishlist_id
           WHERE w.user_id = ? AND i.archived_at IS NULL) AS items,
         (SELECT COUNT(*) FROM wishlist_events e JOIN wishlists w ON w.id = e.wishlist_id
           WHERE w.user_id = ? AND e.kind = 'view') AS views,
         (SELECT COUNT(*) FROM reservations r
            JOIN items i ON i.id = r.item_id
            JOIN wishlists w ON w.id = i.wishlist_id
           WHERE w.user_id = ? AND r.status IN ('reserved','purchased')) AS activity`,
    )
    .get(userId, userId, userId, userId) as any;
  return row as { lists: number; items: number; views: number; activity: number };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
