import "server-only";
import { db, id, now } from "./db";
import { getSettings } from "./auth";
import type { Notification } from "./types";

function insert(row: {
  userId: string;
  audience: "owner" | "buyer";
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, audience, type, title, body, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id(),
    row.userId,
    row.audience,
    row.type,
    row.title,
    row.body ?? null,
    row.href ?? null,
    now(),
  );
}

/**
 * Tells an owner that something happened on a list without naming the item.
 * When surprise mode is off the owner opted in to knowing which item moved, so
 * the extra detail is passed through; otherwise it is never written to the row
 * in the first place — a notification cannot leak what it does not contain.
 */
export function notifyGiftActivity(opts: {
  ownerId: string;
  wishlistId: string;
  wishlistTitle: string;
  wishlistHref: string;
  itemName: string;
  kind: "reserved" | "purchased" | "released";
}) {
  const settings = getSettings(opts.ownerId);
  db.prepare(
    `INSERT INTO wishlist_events (id, wishlist_id, kind, created_at) VALUES (?, ?, 'gift_activity', ?)`,
  ).run(id(), opts.wishlistId, now());

  if (!settings.appNotifications || !settings.notifyGiftActivity) return;

  if (settings.surpriseMode) {
    // Deliberately vague, and only for new claims — a release would hint at a
    // change of heart on a specific item if it arrived on its own.
    if (opts.kind !== "reserved") return;
    insert({
      userId: opts.ownerId,
      audience: "owner",
      type: "gift_activity",
      title: `Someone is planning something for ${opts.wishlistTitle}`,
      body: "Surprise mode is on, so the details stay hidden until you unwrap it.",
      href: opts.wishlistHref,
    });
    return;
  }

  const verb =
    opts.kind === "reserved" ? "was claimed" : opts.kind === "purchased" ? "was bought" : "is available again";
  insert({
    userId: opts.ownerId,
    audience: "owner",
    type: "gift_activity",
    title: `${opts.itemName} ${verb}`,
    body: `On ${opts.wishlistTitle}. You have surprise mode off, so you see item updates.`,
    href: opts.wishlistHref,
  });
}

export function notifyBuyer(opts: {
  buyerId: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
}) {
  const settings = getSettings(opts.buyerId);
  if (!settings.appNotifications) return;
  if (opts.type.startsWith("reservation") && !settings.notifyReservationReminders) return;
  insert({
    userId: opts.buyerId,
    audience: "buyer",
    type: opts.type,
    title: opts.title,
    body: opts.body,
    href: opts.href,
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function listNotifications(userId: string, limit = 40): Notification[] {
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    audience: r.audience,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function unreadCount(userId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`)
    .get(userId) as { n: number };
  return row.n;
}

export function markAllRead(userId: string) {
  db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).run(
    now(),
    userId,
  );
}
