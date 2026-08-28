"use server";

import { revalidatePath } from "next/cache";
import { requireUser, usernameIssue } from "@/lib/auth";
import { db } from "@/lib/db";
import { markAllRead } from "@/lib/notifications";

export type SettingsState = { ok?: boolean; error?: string; field?: string } | null;

export async function updateProfileAction(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const displayName = String(form.get("displayName") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const bio = String(form.get("bio") ?? "").trim() || null;
  const location = String(form.get("location") ?? "").trim() || null;
  const accent = String(form.get("accent") ?? "madder");
  const visibility = String(form.get("profileVisibility") ?? "public");
  const discoverable = form.get("discoverable") === "on" ? 1 : 0;

  if (displayName.length < 2) return { error: "Add a name people will recognise.", field: "displayName" };
  if (username !== user.profile.username) {
    const issue = await usernameIssue(username);
    if (issue) return { error: issue, field: "username" };
  }

  const links = [0, 1, 2]
    .map((i) => ({
      label: String(form.get(`linkLabel${i}`) ?? "").trim(),
      url: String(form.get(`linkUrl${i}`) ?? "").trim(),
    }))
    .filter((l) => l.label && l.url);

  await db.prepare(
    `UPDATE profiles
        SET display_name = ?, username = ?, bio = ?, location = ?, accent = ?,
            visibility = ?, discoverable = ?, links = ?
      WHERE user_id = ?`,
  ).run(
    displayName,
    username,
    bio,
    location,
    accent,
    visibility,
    discoverable,
    JSON.stringify(links),
    user.id,
  );

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/${username}`);
  return { ok: true };
}

export async function updateGiftingAction(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const days = Math.min(60, Math.max(1, Number(form.get("reservationDays") ?? 7) || 7));

  await db.prepare(
    `UPDATE settings
        SET surprise_mode = ?, allow_guest_reservations = ?, reservations_expire = ?,
            reservation_days = ?, default_visibility = ?
      WHERE user_id = ?`,
  ).run(
    form.get("surpriseMode") === "on" ? 1 : 0,
    form.get("allowGuests") === "on" ? 1 : 0,
    form.get("reservationsExpire") === "on" ? 1 : 0,
    days,
    String(form.get("defaultVisibility") ?? "link"),
    user.id,
  );

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateNotificationsAction(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  await db.prepare(
    `UPDATE settings
        SET email_notifications = ?, app_notifications = ?,
            notify_gift_activity = ?, notify_reservation_reminders = ?
      WHERE user_id = ?`,
  ).run(
    form.get("emailNotifications") === "on" ? 1 : 0,
    form.get("appNotifications") === "on" ? 1 : 0,
    form.get("notifyGiftActivity") === "on" ? 1 : 0,
    form.get("notifyReminders") === "on" ? 1 : 0,
    user.id,
  );
  revalidatePath("/settings");
  return { ok: true };
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/notifications", "layout");
}
