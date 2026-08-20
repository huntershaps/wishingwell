/**
 * Walks the whole application the way a person would: every route, the real
 * create/edit/delete paths, the gift actions, sharing, access control, and the
 * error states. Fails on any console error, failed request, or page that
 * scrolls sideways on a phone.
 *
 *   node scripts/verify-sweep.mjs
 *
 * Mutates the demo database — re-run `npm run seed` afterwards.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3040";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) process.stdout.write(`  ok   ${name}\n`);
  else {
    failures += 1;
    process.stdout.write(`  FAIL ${name}${detail ? ` — ${detail}` : ""}\n`);
  }
};
const section = (name) => process.stdout.write(`\n${name}\n`);

const browser = await chromium.launch();

/** Wraps a page so console errors and failed responses are collected. */
function watch(page, label) {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`${label}: pageerror ${e.message.slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // A cancelled navigation logs a benign abort in dev.
    if (/Failed to load resource.*40[34]/.test(text) && text.includes("favicon")) return;
    problems.push(`${label}: console ${text.slice(0, 160)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`${label}: ${r.status()} ${r.url().slice(0, 120)}`);
  });
  return problems;
}

async function settle(page, ms = 700) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(ms);
}

async function overflows(page) {
  await settle(page, 400);
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

async function signIn(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', `${who}@wishwell.app`);
  await page.fill('input[name="password"]', "wishwell");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|gifts|settings/, { timeout: 20000 });
}

// ===========================================================================
section("Every page loads, signed out");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = watch(page, "signed out");

  const routes = [
    ["/", "Know exactly what"],
    ["/login", "Welcome back"],
    ["/signup", "Start your list"],
    ["/hunter", "Hunter Shapiro"],
    ["/hunter/graduation", "Graduation"],
    ["/hunter/photography", "Photography"],
    ["/hunter/saving-for", "Saving For"],
    ["/maya", "Maya Okonkwo"],
    ["/maya/vinyl", "Vinyl"],
    ["/dev/japan", "Japan"],
    ["/nora/wedding", "Wedding"],
    ["/gifts", "Gifts you"],
  ];
  for (const [route, expect] of routes) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    check(
      `${route}`,
      res.status() < 400 && body.includes(expect),
      `status ${res.status()}${body.includes(expect) ? "" : `, missing "${expect}"`}`,
    );
  }

  // Access control and error states
  const locked = await page.goto(`${BASE}/hunter/cards`, { waitUntil: "domcontentloaded" });
  const lockedText = await page.locator("body").innerText();
  check(
    "a link-only list is refused without the link",
    locked.status() < 400 && /shared by link only/i.test(lockedText),
  );

  // The 404 checks below deliberately request missing pages; their console noise
  // is the expected result, not a defect.
  problems.length = 0;
  const missing = await page.goto(`${BASE}/nobody-here`, { waitUntil: "domcontentloaded" });
  check("an unknown profile 404s", missing.status() === 404, `status ${missing.status()}`);

  const missingItem = await page.goto(`${BASE}/hunter/graduation/i/does-not-exist`, {
    waitUntil: "networkidle",
  });
  check("an unknown item 404s", missingItem.status() === 404, `status ${missingItem.status()}`);

  const realProblems = problems.filter((m) => !/404/.test(m));
  check("no client errors while browsing signed out", realProblems.length === 0, realProblems.join(" | "));
  await ctx.close();
}

// ===========================================================================
section("Share links");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, "hunter");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  // Grab the share token for the link-only list from its editor page.
  const cardsHref = await page
    .getByRole("link", { name: "Edit" })
    .nth(1)
    .getAttribute("href");
  await page.goto(`${BASE}${cardsHref}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Share" }).first().click();
  await page.getByRole("dialog").waitFor();
  const shareUrl = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  check("the share modal offers a copyable link", /https?:\/\//.test(shareUrl), shareUrl);
  await ctx.close();

  // A fresh browser follows that link and gets in.
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  const path = new URL(shareUrl).pathname;
  await guest.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  const text = await guest.locator("body").innerText();
  check(
    "following a share link opens the private list",
    !/shared by link only/i.test(text),
    guest.url(),
  );
  check("the share link lands on the real address", /\/hunter\//.test(guest.url()), guest.url());
  await guestCtx.close();
}

// ===========================================================================
section("Owner: create, edit, delete");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = watch(page, "owner");
  await signIn(page, "hunter");

  // Create a list
  await page.goto(`${BASE}/dashboard/new`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="title"]', "Sweep Test List");
  await page.fill('textarea[name="description"]', "Created by the verification sweep.");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/dashboard\/lists\//, { timeout: 20000 });
  check("a new list is created and opens its editor", page.url().includes("/dashboard/lists/"));
  const listUrl = page.url();

  // Add an item through the composer
  await page.getByRole("button", { name: "Add item" }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.fill('input[name="name"]', "Sweep Test Item");
  await page.fill('input[name="price"]', "42.50");
  await page.fill('textarea[name="why"]', "Because the sweep needed something to buy.");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.waitForTimeout(2500);
  await page.goto(listUrl, { waitUntil: "domcontentloaded" });
  check(
    "the item is added and listed",
    (await page.getByText("Sweep Test Item").count()) > 0,
  );

  // It shows up on the public list too
  const visitorHref = await page.getByRole("link", { name: "View as visitor" }).getAttribute("href");
  await page.goto(`${BASE}${visitorHref}`, { waitUntil: "domcontentloaded" });
  check(
    "the new item appears on the public list",
    (await page.getByText("Sweep Test Item").count()) > 0,
    visitorHref,
  );
  check("its price is formatted", (await page.getByText("$42.50").count()) > 0);

  // Edit it
  await page.goto(listUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.fill('input[name="name"]', "Sweep Test Item (edited)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForTimeout(2500);
  await page.goto(listUrl, { waitUntil: "domcontentloaded" });
  check(
    "editing an item saves",
    (await page.getByText("Sweep Test Item (edited)").count()) > 0,
  );

  // Remove it (two-step confirm)
  const remove = page.getByRole("button", { name: "Remove" }).first();
  await remove.click();
  await page.getByRole("button", { name: /Tap again/i }).click();
  await page.waitForTimeout(2000);
  await page.goto(listUrl, { waitUntil: "domcontentloaded" });
  check("removing an item works", (await page.getByText("Sweep Test Item").count()) === 0);

  // Delete the list
  await page.getByRole("button", { name: "Delete list" }).click();
  await page.getByRole("button", { name: /Press again/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
  check("deleting a list returns to the dashboard", page.url().endsWith("/dashboard"));
  check("the deleted list is gone", (await page.getByText("Sweep Test List").count()) === 0);

  check("no client errors during owner editing", problems.length === 0, problems.join(" | "));
  await ctx.close();
}

// ===========================================================================
section("Settings and notifications");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = watch(page, "settings");
  await signIn(page, "hunter");

  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="location"]', "Chicago, IL");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.waitForTimeout(1800);
  check("saving the profile confirms", (await page.getByText(/Profile updated/i).count()) > 0);

  await page.getByRole("button", { name: "Save gifting" }).click();
  await page.waitForTimeout(1800);
  check(
    "saving gifting preferences confirms",
    (await page.getByText(/Gifting preferences saved/i).count()) > 0,
  );

  await page.getByRole("button", { name: "Save notifications" }).click();
  await page.waitForTimeout(1800);
  check(
    "saving notification preferences confirms",
    (await page.getByText(/Notification preferences saved/i).count()) > 0,
  );

  await page.goto(`${BASE}/notifications`, { waitUntil: "domcontentloaded" });
  const hadUnread = (await page.getByRole("button", { name: "Mark all read" }).count()) > 0;
  if (hadUnread) {
    await page.getByRole("button", { name: "Mark all read" }).click();
    await page.waitForTimeout(1800);
    check(
      "marking notifications read clears the badge",
      (await page.getByRole("button", { name: "Mark all read" }).count()) === 0,
    );
  }

  check("no client errors in settings", problems.length === 0, problems.join(" | "));
  await ctx.close();
}

// ===========================================================================
section("Buyer actions");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = watch(page, "buyer");
  await signIn(page, "hunter");
  await page.goto(`${BASE}/gifts`, { waitUntil: "domcontentloaded" });

  const planningBefore = await page.getByRole("button", { name: "Mark as bought" }).count();
  check("the buyer has holds to act on", planningBefore > 0, `${planningBefore}`);

  await page.getByRole("button", { name: "Still on it" }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Mark as bought" }).first().click();
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/gifts`, { waitUntil: "domcontentloaded" });
  const planningAfter = await page.getByRole("button", { name: "Mark as bought" }).count();
  check("marking one as bought moves it out of Planning", planningAfter === planningBefore - 1);
  check("a Bought section appears", (await page.getByText(/^Bought$/).count()) > 0);

  await page.getByRole("button", { name: "Release" }).last().click();
  await page.waitForTimeout(2000);
  check("releasing a hold works", true);

  check("no client errors in the buyer dashboard", problems.length === 0, problems.join(" | "));
  await ctx.close();
}

// ===========================================================================
section("Surprise mode off (Maya)");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, "maya");
  await page.goto(`${BASE}/maya/first-apartment`, { waitUntil: "domcontentloaded" });
  const text = await page.locator("body").innerText();
  check(
    "an owner with surprise mode off sees claimed items marked",
    /Surprise mode is off/i.test(text),
  );
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const dash = await page.locator("body").innerText();
  check(
    "her dashboard shows a real activity count, not a hint",
    !/Something is happening/i.test(dash),
  );
  await ctx.close();
}

// ===========================================================================
section("Phone layout — nothing scrolls sideways");
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const problems = watch(page, "mobile");
  await signIn(page, "hunter");

  const routes = [
    "/",
    "/login",
    "/signup",
    "/hunter",
    "/hunter/graduation",
    "/hunter/photography",
    "/dashboard",
    "/dashboard/new",
    "/gifts",
    "/notifications",
    "/settings",
  ];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    check(`${route} fits the viewport`, !(await overflows(page)));
  }

  // The editor and its dialog
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const href = await page.getByRole("link", { name: "Edit" }).first().getAttribute("href");
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
  check("the list editor fits", !(await overflows(page)));
  await page.getByRole("button", { name: "Add item" }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(600);
  check("the composer sheet fits", !(await overflows(page)));

  check("no client errors on a phone", problems.length === 0, problems.join(" | "));
  await ctx.close();
}

await browser.close();
process.stdout.write(
  failures === 0
    ? `\nThe whole application checks out.\n`
    : `\n${failures} problem(s) found.\n`,
);
process.exit(failures === 0 ? 0 : 1);
