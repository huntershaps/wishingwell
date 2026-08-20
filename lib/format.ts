import type { Priority } from "./types";

export function money(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return null;
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function shortDate(ts: number | null | undefined) {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(ts);
}

export function longDate(ts: number | null | undefined) {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(ts);
}

export function monthYear(ts: number | null | undefined) {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(ts);
}

const DAY = 86_400_000;

export function relativeTime(ts: number, from = Date.now()) {
  const diff = ts - from;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 7 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / (7 * DAY)), "week");
  return rtf.format(Math.round(diff / (30 * DAY)), "month");
}

/** "5 days left" / "today" / "expired" — phrased for a countdown, not a clock. */
export function daysLeft(expiresAt: number | null, from = Date.now()) {
  if (!expiresAt) return null;
  const diff = expiresAt - from;
  if (diff <= 0) return "expired";
  const days = Math.ceil(diff / DAY);
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function countdownToEvent(eventDate: number | null, from = Date.now()) {
  if (!eventDate) return null;
  const diff = eventDate - from;
  const days = Math.ceil(diff / DAY);
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 45) return `${days} days away`;
  return null;
}

export const PRIORITY: Record<
  Priority,
  { label: string; short: string; weight: number; hint: string }
> = {
  dream: { label: "Dream item", short: "Dream", weight: 3, hint: "The one they would not buy for themselves" },
  high: { label: "Really wants", short: "High", weight: 2, hint: "Near the top of the list" },
  medium: { label: "Would love", short: "Medium", weight: 1, hint: "A solid pick" },
  someday: { label: "Someday", short: "Someday", weight: 0, hint: "No rush at all" },
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function hostFromUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
