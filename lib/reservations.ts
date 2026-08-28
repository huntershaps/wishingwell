import "server-only";
import { db, id, now, tx } from "./db";
import { notifyBuyer, notifyGiftActivity } from "./notifications";
import type { ReservationStatus, Viewer } from "./types";

const DAY = 1000 * 60 * 60 * 24;

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReserveError =
  | "taken" // someone else got there first
  | "own_item" // you cannot claim a gift on your own list
  | "guests_blocked" // owner requires buyers to sign in
  | "missing"; // item is gone

export type ReserveResult =
  | { ok: true; reservationId: string; expiresAt: number | null }
  | { ok: false; error: ReserveError };

type ItemContext = {
  itemId: string;
  itemName: string;
  wishlistId: string;
  wishlistTitle: string;
  ownerId: string;
  username: string;
  slug: string;
  surpriseMode: number;
  allowGuests: number;
  expiresEnabled: number;
  reservationDays: number;
};

async function itemContext(itemId: string): Promise<ItemContext | null> {
  const row = await db
    .prepare(
      `SELECT i.id AS itemId, i.name AS itemName,
              w.id AS wishlistId, w.title AS wishlistTitle, w.slug AS slug,
              u.id AS ownerId, p.username AS username,
              s.surprise_mode AS surpriseMode,
              s.allow_guest_reservations AS allowGuests,
              s.reservations_expire AS expiresEnabled,
              s.reservation_days AS reservationDays
         FROM items i
         JOIN wishlists w ON w.id = i.wishlist_id
         JOIN users u ON u.id = w.user_id
         JOIN profiles p ON p.user_id = u.id
         LEFT JOIN settings s ON s.user_id = u.id
        WHERE i.id = ? AND i.archived_at IS NULL`,
    )
    .get(itemId) as any;
  return row ?? null;
}

export function listHref(ctx: { username: string; slug: string }) {
  return `/${ctx.username}/${ctx.slug}`;
}

/**
 * Claims an item for the viewer.
 *
 * Two people tapping "I'll get this" at the same moment both reach the INSERT;
 * the partial unique index on (item_id) WHERE status IN ('reserved','purchased')
 * lets exactly one commit and rejects the other, so the second buyer is told the
 * truth instead of quietly creating a duplicate gift.
 */
export async function reserveItem(opts: {
  itemId: string;
  viewer: Viewer;
  note?: string | null;
  guestName?: string | null;
}): Promise<ReserveResult> {
  const ctx = await itemContext(opts.itemId);
  if (!ctx) return { ok: false, error: "missing" };
  if (opts.viewer.userId && opts.viewer.userId === ctx.ownerId)
    return { ok: false, error: "own_item" };
  if (!opts.viewer.userId && !ctx.allowGuests) return { ok: false, error: "guests_blocked" };
  if (!opts.viewer.userId && !opts.viewer.guestToken) return { ok: false, error: "guests_blocked" };

  const ts = now();
  const expiresAt = ctx.expiresEnabled ? ts + ctx.reservationDays * DAY : null;
  const reservationId = id();

  try {
    await tx(async (t) => {
      await t.prepare(
        `INSERT INTO reservations
           (id, item_id, buyer_user_id, guest_token, guest_name, status, note, reserved_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`,
      ).run(
        reservationId,
        opts.itemId,
        opts.viewer.userId,
        opts.viewer.userId ? null : opts.viewer.guestToken,
        opts.guestName ?? null,
        opts.note ?? null,
        ts,
        expiresAt,
      );
    });
  } catch (err: any) {
    if (String(err?.code ?? "").includes("CONSTRAINT")) return { ok: false, error: "taken" };
    throw err;
  }

  notifyGiftActivity({
    ownerId: ctx.ownerId,
    wishlistId: ctx.wishlistId,
    wishlistTitle: ctx.wishlistTitle,
    wishlistHref: listHref(ctx),
    itemName: ctx.itemName,
    kind: "reserved",
  });

  return { ok: true, reservationId, expiresAt };
}

function ownsReservation(row: any, viewer: Viewer) {
  if (!row) return false;
  if (row.buyer_user_id) return row.buyer_user_id === viewer.userId;
  return !!viewer.guestToken && row.guest_token === viewer.guestToken;
}

async function getReservation(reservationId: string) {
  return await db.prepare(`SELECT * FROM reservations WHERE id = ?`).get(reservationId) as any;
}

export async function releaseReservation(reservationId: string, viewer: Viewer): Promise<boolean> {
  const row = await getReservation(reservationId);
  if (!ownsReservation(row, viewer)) return false;
  if (row.status !== "reserved" && row.status !== "purchased") return false;
  await db.prepare(`UPDATE reservations SET status = 'released', released_at = ? WHERE id = ?`).run(
    now(),
    reservationId,
  );
  const ctx = await itemContext(row.item_id);
  if (ctx)
    notifyGiftActivity({
      ownerId: ctx.ownerId,
      wishlistId: ctx.wishlistId,
      wishlistTitle: ctx.wishlistTitle,
      wishlistHref: listHref(ctx),
      itemName: ctx.itemName,
      kind: "released",
    });
  return true;
}

export async function markPurchased(reservationId: string, viewer: Viewer): Promise<boolean> {
  const row = await getReservation(reservationId);
  if (!ownsReservation(row, viewer)) return false;
  if (row.status !== "reserved") return false;
  await db.prepare(`UPDATE reservations SET status = 'purchased', purchased_at = ?, expires_at = NULL WHERE id = ?`).run(
    now(),
    reservationId,
  );
  const ctx = await itemContext(row.item_id);
  if (ctx)
    notifyGiftActivity({
      ownerId: ctx.ownerId,
      wishlistId: ctx.wishlistId,
      wishlistTitle: ctx.wishlistTitle,
      wishlistHref: listHref(ctx),
      itemName: ctx.itemName,
      kind: "purchased",
    });
  return true;
}

/** Buyer says "still on it" — pushes the hold out by the owner's window. */
export async function extendReservation(reservationId: string, viewer: Viewer): Promise<number | null> {
  const row = await getReservation(reservationId);
  if (!ownsReservation(row, viewer) || row.status !== "reserved") return null;
  const ctx = await itemContext(row.item_id);
  if (!ctx || !ctx.expiresEnabled) return null;
  const next = now() + ctx.reservationDays * DAY;
  await db.prepare(`UPDATE reservations SET expires_at = ?, reminded_at = NULL WHERE id = ?`).run(
    next,
    reservationId,
  );
  return next;
}

/**
 * Releases holds nobody followed through on, and warns buyers a couple of days
 * out. Called on read paths — the work is index-bound and almost always empty.
 */
export async function runReservationMaintenance() {
  const ts = now();

  const expired = await db
    .prepare(
      `SELECT r.id, r.buyer_user_id AS buyerId, i.name AS itemName, p.username, w.slug
         FROM reservations r
         JOIN items i ON i.id = r.item_id
         JOIN wishlists w ON w.id = i.wishlist_id
         JOIN profiles p ON p.user_id = w.user_id
        WHERE r.status = 'reserved' AND r.expires_at IS NOT NULL AND r.expires_at < ?`,
    )
    .all(ts) as any[];

  for (const row of expired) {
    await db.prepare(`UPDATE reservations SET status = 'expired' WHERE id = ?`).run(row.id);
    if (row.buyerId)
      notifyBuyer({
        buyerId: row.buyerId,
        type: "reservation_expired",
        title: `Your hold on ${row.itemName} expired`,
        body: "It is back on the list for someone else. You can claim it again if you still want it.",
        href: `/${row.username}/${row.slug}`,
      });
  }

  const soon = await db
    .prepare(
      `SELECT r.id, r.buyer_user_id AS buyerId, r.expires_at AS expiresAt,
              i.name AS itemName, p.username, w.slug
         FROM reservations r
         JOIN items i ON i.id = r.item_id
         JOIN wishlists w ON w.id = i.wishlist_id
         JOIN profiles p ON p.user_id = w.user_id
        WHERE r.status = 'reserved' AND r.reminded_at IS NULL
          AND r.expires_at IS NOT NULL AND r.expires_at BETWEEN ? AND ?
          AND r.buyer_user_id IS NOT NULL`,
    )
    .all(ts, ts + 2 * DAY) as any[];

  for (const row of soon) {
    await db.prepare(`UPDATE reservations SET reminded_at = ? WHERE id = ?`).run(ts, row.id);
    notifyBuyer({
      buyerId: row.buyerId,
      type: "reservation_expiring",
      title: `Still getting ${row.itemName}?`,
      body: "Your hold runs out in two days. Confirm the purchase or keep the hold going.",
      href: "/gifts",
    });
  }
}

export type BuyerReservation = {
  id: string;
  status: ReservationStatus;
  reservedAt: number;
  expiresAt: number | null;
  purchasedAt: number | null;
  releasedAt: number | null;
  note: string | null;
  itemId: string;
  itemName: string;
  priceCents: number | null;
  currency: string;
  productUrl: string | null;
  store: string | null;
  imageUrl: string | null;
  wishlistTitle: string;
  wishlistIcon: string | null;
  occasion: string | null;
  eventDate: number | null;
  ownerName: string;
  ownerUsername: string;
  ownerAvatar: string | null;
  href: string;
};

export async function listBuyerReservations(viewer: Viewer): Promise<BuyerReservation[]> {
  if (!viewer.userId && !viewer.guestToken) return [];
  await runReservationMaintenance();
  const rows = await db
    .prepare(
      `SELECT r.id, r.status, r.reserved_at AS reservedAt, r.expires_at AS expiresAt,
              r.purchased_at AS purchasedAt, r.released_at AS releasedAt, r.note,
              i.id AS itemId, i.name AS itemName, i.price_cents AS priceCents,
              i.currency, i.url AS productUrl, i.store,
              (SELECT m.url FROM item_media m WHERE m.item_id = i.id AND m.kind = 'image'
                ORDER BY m.position LIMIT 1) AS imageUrl,
              w.title AS wishlistTitle, w.icon AS wishlistIcon, w.slug,
              w.occasion, w.event_date AS eventDate,
              p.display_name AS ownerName, p.username AS ownerUsername,
              p.avatar_url AS ownerAvatar
         FROM reservations r
         JOIN items i ON i.id = r.item_id
         JOIN wishlists w ON w.id = i.wishlist_id
         JOIN profiles p ON p.user_id = w.user_id
        WHERE (r.buyer_user_id IS NOT NULL AND r.buyer_user_id = ?)
           OR (r.guest_token IS NOT NULL AND r.guest_token = ?)
        ORDER BY
          CASE r.status WHEN 'reserved' THEN 0 WHEN 'purchased' THEN 1 ELSE 2 END,
          r.reserved_at DESC`,
    )
    .all(viewer.userId ?? " ", viewer.guestToken ?? " ") as any[];

  return rows.map((r) => ({
    ...r,
    href: `/${r.ownerUsername}/${r.slug}?item=${r.itemId}`,
  })) as BuyerReservation[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */
