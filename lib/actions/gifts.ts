"use server";

import { revalidatePath } from "next/cache";
import { ensureGuest, getCurrentUser, getViewer } from "@/lib/auth";
import { getItemRaw } from "@/lib/queries";
import { db } from "@/lib/db";
import {
  extendReservation,
  markPurchased,
  releaseReservation,
  reserveItem,
} from "@/lib/reservations";

export type GiftState =
  | { status: "idle" }
  | { status: "reserved"; reservationId: string; expiresAt: number | null }
  | { status: "error"; message: string };

function listPathForItem(itemId: string): string | null {
  const row = db
    .prepare(
      `SELECT p.username, w.slug
         FROM items i
         JOIN wishlists w ON w.id = i.wishlist_id
         JOIN profiles p ON p.user_id = w.user_id
        WHERE i.id = ?`,
    )
    .get(itemId) as { username: string; slug: string } | undefined;
  return row ? `/${row.username}/${row.slug}` : null;
}

const MESSAGES: Record<string, string> = {
  taken: "Someone claimed this a moment before you. Nothing was double-bought.",
  own_item: "This one is on your own list, so it stays a surprise.",
  guests_blocked: "This list asks buyers to sign in first.",
  missing: "That item is no longer on the list.",
};

export async function reserveAction(_prev: GiftState, form: FormData): Promise<GiftState> {
  const itemId = String(form.get("itemId") ?? "");
  const note = String(form.get("note") ?? "").trim() || null;
  const guestName = String(form.get("guestName") ?? "").trim() || null;

  const item = getItemRaw(itemId);
  if (!item) return { status: "error", message: MESSAGES.missing };

  const user = await getCurrentUser();
  let viewer = await getViewer();
  if (!user) {
    // Guests get a durable cookie identity so they can manage the hold later.
    const guestToken = await ensureGuest(guestName ?? undefined);
    viewer = { userId: null, guestToken };
  }

  const result = reserveItem({ itemId, viewer, note, guestName });
  if (!result.ok) return { status: "error", message: MESSAGES[result.error] ?? "Something went wrong." };

  const path = listPathForItem(itemId);
  if (path) revalidatePath(path);
  revalidatePath("/gifts");
  return { status: "reserved", reservationId: result.reservationId, expiresAt: result.expiresAt };
}

async function transition(
  form: FormData,
  fn: (reservationId: string, viewer: Awaited<ReturnType<typeof getViewer>>) => unknown,
) {
  const reservationId = String(form.get("reservationId") ?? "");
  const viewer = await getViewer();
  const ok = fn(reservationId, viewer);
  const itemId = String(form.get("itemId") ?? "");
  if (itemId) {
    const path = listPathForItem(itemId);
    if (path) revalidatePath(path);
  }
  revalidatePath("/gifts");
  return ok;
}

export async function purchaseAction(_prev: unknown, form: FormData) {
  const ok = await transition(form, markPurchased);
  return ok ? { status: "purchased" as const } : { status: "error" as const };
}

export async function releaseAction(_prev: unknown, form: FormData) {
  const ok = await transition(form, releaseReservation);
  return ok ? { status: "released" as const } : { status: "error" as const };
}

export async function extendAction(_prev: unknown, form: FormData) {
  const next = await transition(form, extendReservation);
  return next ? { status: "extended" as const } : { status: "error" as const };
}
