import "server-only";
import { cookies } from "next/headers";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, id, now, token, tx } from "./db";
import type { Profile, Settings, Viewer } from "./types";

const scryptAsync = promisify(scrypt) as (
  pw: string,
  salt: Buffer,
  len: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "ww_session";
const GUEST_COOKIE = "ww_guest";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = await scryptAsync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// ---------------------------------------------------------------- sessions

export async function createSession(userId: string) {
  const sid = token(24);
  const created = now();
  await db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
  ).run(sid, userId, created, created + SESSION_TTL);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) await db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  profile: Profile;
  settings: Settings;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.email, s.expires_at AS expiresAt
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .get(sid) as { id: string; email: string; expiresAt: number } | undefined;
  if (!row) return null;
  if (row.expiresAt < now()) {
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
    return null;
  }
  const profile = await getProfile(row.id);
  const settings = await getSettings(row.id);
  if (!profile) return null;
  return { id: row.id, email: row.email, profile, settings };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

// ------------------------------------------------------------------ guests

/** Reads the guest cookie without creating one. */
export async function getGuestToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value ?? null;
}

/** Creates a durable guest identity so a guest can manage their own reservations. */
export async function ensureGuest(name?: string): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing && await db.prepare(`SELECT 1 FROM guests WHERE token = ?`).get(existing)) {
    if (name) await db.prepare(`UPDATE guests SET name = ? WHERE token = ?`).run(name, existing);
    return existing;
  }
  const t = token(18);
  await db.prepare(`INSERT INTO guests (token, name, created_at) VALUES (?, ?, ?)`).run(
    t,
    name ?? null,
    now(),
  );
  jar.set(GUEST_COOKIE, t, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return t;
}

export async function getViewer(): Promise<Viewer> {
  const user = await getCurrentUser();
  return { userId: user?.id ?? null, guestToken: await getGuestToken() };
}

// ---------------------------------------------------------------- profiles

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getProfile(userId: string): Promise<Profile | null> {
  const row = await db.prepare(`SELECT * FROM profiles WHERE user_id = ?`).get(userId) as any;
  return row ? mapProfile(row) : null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const row = await db.prepare(`SELECT * FROM profiles WHERE username = ?`).get(username) as any;
  return row ? mapProfile(row) : null;
}

export function mapProfile(row: any): Profile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    accent: row.accent,
    location: row.location,
    links: JSON.parse(row.links || "[]"),
    visibility: row.visibility,
    discoverable: !!row.discoverable,
  };
}

export async function getSettings(userId: string): Promise<Settings> {
  let row = await db.prepare(`SELECT * FROM settings WHERE user_id = ?`).get(userId) as any;
  if (!row) {
    await db.prepare(`INSERT INTO settings (user_id) VALUES (?)`).run(userId);
    row = await db.prepare(`SELECT * FROM settings WHERE user_id = ?`).get(userId);
  }
  return {
    userId,
    surpriseMode: !!row.surprise_mode,
    allowGuestReservations: !!row.allow_guest_reservations,
    reservationsExpire: !!row.reservations_expire,
    reservationDays: row.reservation_days,
    defaultVisibility: row.default_visibility,
    emailNotifications: !!row.email_notifications,
    appNotifications: !!row.app_notifications,
    notifyGiftActivity: !!row.notify_gift_activity,
    notifyReservationReminders: !!row.notify_reservation_reminders,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ------------------------------------------------------------ registration

export const RESERVED_USERNAMES = new Set([
  "about", "api", "admin", "dashboard", "explore", "gifts", "help", "login",
  "logout", "new", "notifications", "privacy", "settings", "signup", "support",
  "terms", "w", "www", "wishwell", "media", "_next", "static",
]);

export async function usernameIssue(username: string): Promise<string | null> {
  if (!/^[a-z0-9_]{3,24}$/i.test(username))
    return "Usernames use 3 to 24 letters, numbers, or underscores.";
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return "That username is taken.";
  const taken = await db.prepare(`SELECT 1 FROM profiles WHERE username = ?`).get(username);
  return taken ? "That username is taken." : null;
}

export async function createUser(opts: {
  email: string;
  passwordHash?: string | null;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  accent?: string;
}): Promise<string> {
  return tx(async (t) => {
    const userId = id();
    const ts = now();
    await t.prepare(
      `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`,
    ).run(userId, opts.email, opts.passwordHash ?? null, ts);
    await t.prepare(
      `INSERT INTO profiles (user_id, username, display_name, bio, avatar_url, accent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      opts.username,
      opts.displayName,
      opts.bio ?? null,
      opts.avatarUrl ?? null,
      opts.accent ?? "madder",
      ts,
    );
    await t.prepare(`INSERT INTO settings (user_id) VALUES (?)`).run(userId);
    return userId;
  });
}

export async function findUserByEmail(email: string) {
  return await db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as
    | { id: string; email: string; password_hash: string | null }
    | undefined;
}
