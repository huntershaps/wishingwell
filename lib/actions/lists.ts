"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { db, id, now, token, tx } from "@/lib/db";
import { slugify } from "@/lib/format";
import { UPLOAD_DIR, blobToken, destination, hasVercelBlob } from "@/lib/paths";
import type { Priority, Visibility } from "@/lib/types";

export type ListFormState = { error?: string; field?: string } | null;

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 40 * 1024 * 1024;

async function assertOwnsList(listId: string, userId: string) {
  const row = await db.prepare(`SELECT user_id FROM wishlists WHERE id = ?`).get(listId) as
    | { user_id: string }
    | undefined;
  if (!row || row.user_id !== userId) throw new Error("FORBIDDEN");
}

async function assertOwnsItem(itemId: string, userId: string) {
  const row = await db
    .prepare(
      `SELECT w.user_id AS userId, w.id AS listId
         FROM items i JOIN wishlists w ON w.id = i.wishlist_id WHERE i.id = ?`,
    )
    .get(itemId) as { userId: string; listId: string } | undefined;
  if (!row || row.userId !== userId) throw new Error("FORBIDDEN");
  return row.listId;
}

/**
 * Stores an uploaded photograph or video note.
 *
 * A serverless host has no disk that outlives the request, so each one gets its
 * own object store: Netlify Blobs on Netlify, Blob storage on Vercel. Locally,
 * and in the container build, files are written next to the database instead.
 *
 * Netlify and the disk both keep the /uploads/<name> path, served by
 * app/uploads/[...file]/route.ts. Vercel Blob hands back an absolute URL of its
 * own, which the item stores as-is. Either way an item holds a URL that works
 * where it was created.
 */
async function storeUpload(file: File): Promise<{ url: string; kind: "image" | "video" } | null> {
  if (!file || file.size === 0) {
    console.log("upload: nothing submitted");
    return null;
  }
  console.log("upload: received", file.size, "bytes of", file.type, "→", destination());
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) throw new Error("Only images and videos can be uploaded.");
  if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE))
    throw new Error(isVideo ? "Videos need to be under 40MB." : "Images need to be under 8MB.");

  const ext =
    ({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mp4",
    })[file.type] ?? (isVideo ? "mp4" : "jpg");

  const name = `${token(12)}.${ext}`;

  if (hasVercelBlob()) {
    const explicitToken = blobToken();
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${name}`, file, {
      access: "public",
      contentType: file.type,
      // Omitted when the store authenticates by OIDC, which is the current default.
      ...(explicitToken ? { token: explicitToken } : {}),
    });
    return { url: blob.url, kind: isVideo ? "video" : "image" };
  }

  if (process.env.NETLIFY) {
    const { getStore } = await import("@netlify/blobs");
    await getStore("uploads").set(name, await file.arrayBuffer(), {
      metadata: { contentType: file.type },
    });
    return { url: `/uploads/${name}`, kind: isVideo ? "video" : "image" };
  }

  await fs.mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  await fs.writeFile(
    path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name),
    Buffer.from(await file.arrayBuffer()),
  );
  return { url: `/uploads/${name}`, kind: isVideo ? "video" : "image" };
}

async function uniqueSlug(userId: string, desired: string, ignoreId?: string) {
  const base = slugify(desired) || "list";
  let candidate = base;
  let n = 1;
  for (;;) {
    const clash = await db
      .prepare(`SELECT id FROM wishlists WHERE user_id = ? AND slug = ?`)
      .get(userId, candidate) as { id: string } | undefined;
    if (!clash || clash.id === ignoreId) return candidate;
    candidate = `${base}-${++n}`;
  }
}

// ----------------------------------------------------------------- wishlists

export async function createListAction(_prev: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await requireUser();
  const title = String(form.get("title") ?? "").trim();
  if (title.length < 2) return { error: "Give the list a name.", field: "title" };

  const listId = id();
  const ts = now();
  let cover: { url: string; kind: "image" | "video" } | null = null;
  try {
    cover = await storeUpload(form.get("cover") as File);
  } catch (err) {
    // Silently saving a list without the photograph somebody chose is worse than
    // telling them, and it hid a broken upload path for an entire deployment.
    console.error("cover upload failed", err);
    return { error: "That cover photo could not be saved. The list was not created.", field: "cover" };
  }

  await db.prepare(
    `INSERT INTO wishlists
      (id, user_id, slug, title, description, icon, cover_url, accent, occasion, event_date,
       visibility, share_token, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    listId,
    user.id,
    await uniqueSlug(user.id, String(form.get("slug") ?? "") || title),
    title,
    String(form.get("description") ?? "").trim() || null,
    String(form.get("icon") ?? "").trim() || null,
    cover?.url ?? null,
    String(form.get("accent") ?? "madder"),
    String(form.get("occasion") ?? "").trim() || null,
    form.get("eventDate") ? new Date(String(form.get("eventDate"))).getTime() : null,
    (String(form.get("visibility") ?? user.settings.defaultVisibility) as Visibility) ?? "link",
    token(9),
    0,
    ts,
    ts,
  );

  revalidatePath("/dashboard");
  redirect(`/dashboard/lists/${listId}?created=1`);
}

export async function updateListAction(_prev: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await requireUser();
  const listId = String(form.get("listId") ?? "");
  await assertOwnsList(listId, user.id);

  const title = String(form.get("title") ?? "").trim();
  if (title.length < 2) return { error: "Give the list a name.", field: "title" };

  let coverUrl: string | null | undefined;
  try {
    const cover = await storeUpload(form.get("cover") as File);
    if (cover) coverUrl = cover.url;
  } catch (err) {
    return { error: (err as Error).message, field: "cover" };
  }
  if (form.get("removeCover") === "1") coverUrl = null;

  const current = await db.prepare(`SELECT slug, cover_url FROM wishlists WHERE id = ?`).get(listId) as {
    slug: string;
    cover_url: string | null;
  };

  await db.prepare(
    `UPDATE wishlists
        SET title = ?, slug = ?, description = ?, icon = ?, cover_url = ?, accent = ?,
            occasion = ?, event_date = ?, visibility = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    title,
    await uniqueSlug(user.id, String(form.get("slug") ?? "") || title, listId),
    String(form.get("description") ?? "").trim() || null,
    String(form.get("icon") ?? "").trim() || null,
    coverUrl === undefined ? current.cover_url : coverUrl,
    String(form.get("accent") ?? "madder"),
    String(form.get("occasion") ?? "").trim() || null,
    form.get("eventDate") ? new Date(String(form.get("eventDate"))).getTime() : null,
    String(form.get("visibility") ?? "link") as Visibility,
    now(),
    listId,
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/lists/${listId}`);
  revalidatePath(`/${user.profile.username}`);
  return { error: undefined };
}

export async function deleteListAction(form: FormData) {
  const user = await requireUser();
  const listId = String(form.get("listId") ?? "");
  await assertOwnsList(listId, user.id);
  await db.prepare(`DELETE FROM wishlists WHERE id = ?`).run(listId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function regenerateShareLinkAction(form: FormData) {
  const user = await requireUser();
  const listId = String(form.get("listId") ?? "");
  await assertOwnsList(listId, user.id);
  await db.prepare(`UPDATE wishlists SET share_token = ?, updated_at = ? WHERE id = ?`).run(
    token(9),
    now(),
    listId,
  );
  revalidatePath(`/dashboard/lists/${listId}`);
}

// --------------------------------------------------------------------- items

function itemFields(form: FormData) {
  const priceRaw = String(form.get("price") ?? "").replace(/[^0-9.]/g, "");
  const price = priceRaw ? Math.round(Number(priceRaw) * 100) : null;
  return {
    name: String(form.get("name") ?? "").trim(),
    url: String(form.get("url") ?? "").trim() || null,
    store: String(form.get("store") ?? "").trim() || null,
    price: Number.isFinite(price) ? price : null,
    currency: String(form.get("currency") ?? "USD"),
    description: String(form.get("description") ?? "").trim() || null,
    why: String(form.get("why") ?? "").trim() || null,
    priority: (String(form.get("priority") ?? "medium") as Priority) ?? "medium",
    category: String(form.get("category") ?? "").trim() || null,
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8),
    notes: String(form.get("notes") ?? "").trim() || null,
    size: String(form.get("size") ?? "").trim() || null,
    color: String(form.get("color") ?? "").trim() || null,
    variant: String(form.get("variant") ?? "").trim() || null,
    feature: form.get("feature") === "on" ? 1 : 0,
  };
}

async function saveMedia(itemId: string, form: FormData, startAt: number) {
  let position = startAt;
  const files = [...form.getAll("photos"), form.get("video")].filter(Boolean) as File[];
  for (const file of files) {
    const stored = await storeUpload(file);
    if (!stored) continue;
    await db.prepare(
      `INSERT INTO item_media (id, item_id, kind, url, alt, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id(), itemId, stored.kind, stored.url, null, position++, now());
  }
}

export async function createItemAction(_prev: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await requireUser();
  const listId = String(form.get("listId") ?? "");
  await assertOwnsList(listId, user.id);

  const fields = itemFields(form);
  if (fields.name.length < 2) return { error: "What is it called?", field: "name" };

  const itemId = id();
  const ts = now();
  const position = (await db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM items WHERE wishlist_id = ?`)
    .get(listId) as { next: number }).next;

  try {
    await tx(async (t) => {
      await t.prepare(
        `INSERT INTO items
          (id, wishlist_id, name, url, store, price_cents, currency, description, why_want, priority,
           category, tags, notes, size, color, variant, feature, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        itemId, listId, fields.name, fields.url, fields.store, fields.price, fields.currency,
        fields.description, fields.why, fields.priority, fields.category,
        JSON.stringify(fields.tags), fields.notes, fields.size, fields.color, fields.variant,
        fields.feature, position, ts, ts,
      );
    });
    await saveMedia(itemId, form, 0);
  } catch (err) {
    return { error: (err as Error).message };
  }

  await db.prepare(`UPDATE wishlists SET updated_at = ? WHERE id = ?`).run(ts, listId);
  revalidatePath(`/dashboard/lists/${listId}`);
  revalidatePath("/dashboard");
  return null;
}

export async function updateItemAction(_prev: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await requireUser();
  const itemId = String(form.get("itemId") ?? "");
  const listId = await assertOwnsItem(itemId, user.id);

  const fields = itemFields(form);
  if (fields.name.length < 2) return { error: "What is it called?", field: "name" };

  await db.prepare(
    `UPDATE items SET name = ?, url = ?, store = ?, price_cents = ?, currency = ?, description = ?,
            why_want = ?, priority = ?, category = ?, tags = ?, notes = ?, size = ?, color = ?,
            variant = ?, feature = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    fields.name, fields.url, fields.store, fields.price, fields.currency, fields.description,
    fields.why, fields.priority, fields.category, JSON.stringify(fields.tags), fields.notes,
    fields.size, fields.color, fields.variant, fields.feature, now(), itemId,
  );

  const nextPosition = (await db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM item_media WHERE item_id = ?`)
    .get(itemId) as { next: number }).next;
  try {
    await saveMedia(itemId, form, nextPosition);
  } catch (err) {
    return { error: (err as Error).message };
  }

  revalidatePath(`/dashboard/lists/${listId}`);
  return null;
}

export async function deleteItemAction(form: FormData) {
  const user = await requireUser();
  const itemId = String(form.get("itemId") ?? "");
  const listId = await assertOwnsItem(itemId, user.id);
  await db.prepare(`UPDATE items SET archived_at = ? WHERE id = ?`).run(now(), itemId);
  revalidatePath(`/dashboard/lists/${listId}`);
  revalidatePath("/dashboard");
}

export async function deleteMediaAction(form: FormData) {
  const user = await requireUser();
  const mediaId = String(form.get("mediaId") ?? "");
  const row = await db.prepare(`SELECT item_id FROM item_media WHERE id = ?`).get(mediaId) as
    | { item_id: string }
    | undefined;
  if (!row) return;
  const listId = await assertOwnsItem(row.item_id, user.id);
  await db.prepare(`DELETE FROM item_media WHERE id = ?`).run(mediaId);
  revalidatePath(`/dashboard/lists/${listId}`);
}
