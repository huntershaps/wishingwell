"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  hashPassword,
  usernameIssue,
  verifyPassword,
} from "@/lib/auth";
import { db, id, now, token } from "@/lib/db";
import { slugify } from "@/lib/format";

export type FormState = { error?: string; field?: string } | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (name.length < 2) return { error: "Add the name you want on your lists.", field: "name" };
  if (!emailPattern.test(email)) return { error: "Check that email address.", field: "email" };
  if (password.length < 8) return { error: "Use at least 8 characters.", field: "password" };

  const issue = await usernameIssue(username);
  if (issue) return { error: issue, field: "username" };
  if (await findUserByEmail(email)) return { error: "That email already has an account.", field: "email" };

  const userId = await createUser({
    email,
    passwordHash: await hashPassword(password),
    username,
    displayName: name,
  });

  // A new account with nothing in it is a dead end, so it starts with one list.
  const ts = now();
  await db.prepare(
    `INSERT INTO wishlists (id, user_id, slug, title, description, icon, accent, visibility, share_token, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'madder', 'link', ?, 0, ?, ?)`,
  ).run(
    id(),
    userId,
    "wishlist",
    "My Wishlist",
    "A first list. Rename it, add a cover, make it yours.",
    "✨",
    token(9),
    ts,
    ts,
  );

  await createSession(userId);
  redirect("/dashboard?welcome=1");
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/dashboard");

  const user = await findUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok) return { error: "That email and password do not match.", field: "email" };

  await createSession(user.id);
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOutAction() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Suggests a username from a display name, used by the sign-up form. */
export async function suggestUsername(name: string) {
  const base = slugify(name).replace(/-/g, "") || "you";
  let candidate = base.slice(0, 20);
  let n = 1;
  while (await usernameIssue(candidate)) candidate = `${base.slice(0, 18)}${++n}`;
  return candidate;
}
