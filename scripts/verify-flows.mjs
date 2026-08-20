/**
 * Drives the gift flow through the real UI: a guest claims something, the item
 * locks for everyone else, and the owner is shown nothing.
 *
 *   node scripts/verify-flows.mjs
 *
 * Mutates the demo database — re-run `npm run seed` afterwards.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3040";
const LIST = "/hunter/photography";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) process.stdout.write(`  ok   ${name}\n`);
  else {
    failures += 1;
    process.stdout.write(`  FAIL ${name}${detail ? ` — ${detail}` : ""}\n`);
  }
};

const browser = await chromium.launch();

// ------------------------------------------------------- a guest claims one
const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await guest.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}${LIST}`, { waitUntil: "networkidle" });

const claimButtons = page.getByRole("button", { name: /I'll get this/i });
const availableBefore = await claimButtons.count();
check("the list offers items to claim", availableBefore > 0, `${availableBefore} found`);

const targetName = await page
  .locator("article")
  .filter({ has: page.getByRole("button", { name: /I'll get this/i }) })
  .first()
  .locator("h3")
  .innerText();

await claimButtons.first().click();
await page.getByRole("dialog").waitFor({ state: "visible" });
check("the claim opens a confirmation, not an instant purchase", true);

const surprisePromise = await page
  .getByRole("dialog")
  .getByText(/never see who claimed it|sees that the list has activity/i)
  .count();
check("the confirmation explains the surprise is kept", surprisePromise > 0);

await page.getByRole("dialog").locator('input[name="guestName"]').fill("Ro");
await page.getByRole("dialog").getByRole("button", { name: /^Hold /i }).click();
await page.getByText(/is held for you/i).waitFor({ timeout: 15000 });
check("the guest gets a confirmation that it is held", true);

await page.keyboard.press("Escape");
await page.reload({ waitUntil: "networkidle" });

const claimedCard = page
  .locator("article")
  .filter({ hasText: targetName.trim() })
  .first();
const nowClaimed = await claimedCard.getByText(/You are getting this|Spoken for/i).count();
check(`"${targetName.trim()}" now reads as claimed`, nowClaimed > 0);

const availableAfter = await page.getByRole("button", { name: /I'll get this/i }).count();
check("one fewer item is claimable", availableAfter === availableBefore - 1, `${availableAfter} left`);

// ------------------------------------------------- a second visitor is told
const other = await browser.newContext();
const otherPage = await other.newPage();
await otherPage.goto(`${BASE}${LIST}`, { waitUntil: "networkidle" });
const otherSees = await otherPage
  .locator("article")
  .filter({ hasText: targetName.trim() })
  .first()
  .getByText(/Spoken for/i)
  .count();
check("another visitor sees it is spoken for", otherSees > 0);
const namesLeaked = await otherPage.getByText(/\bRo\b/).count();
check("the buyer's name is not shown to other visitors", namesLeaked === 0);

// ---------------------------------------------------- the owner sees nothing
const ownerCtx = await browser.newContext();
const ownerPage = await ownerCtx.newPage();
await ownerPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await ownerPage.fill('input[name="email"]', "hunter@wishwell.app");
await ownerPage.fill('input[name="password"]', "wishwell");
await ownerPage.click('button[type="submit"]');
await ownerPage.waitForURL(/dashboard/, { timeout: 20000 });
await ownerPage.goto(`${BASE}${LIST}`, { waitUntil: "networkidle" });

const ownerTags = await ownerPage.locator('article').getByText(/Spoken for|Already bought|You are getting this/i).count();
check("the owner sees no claim tags at all", ownerTags === 0, `${ownerTags} visible`);
const ownerBody = await ownerPage.locator("body").innerText();
check("the owner page never names the buyer", !/\bRo\b/.test(ownerBody));

await ownerPage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const activityShown = await ownerPage.getByText(/Something is happening/i).count();
check("the owner is told something is happening", activityShown > 0);

// --------------------------------------------------- the guest can manage it
await page.goto(`${BASE}/gifts`, { waitUntil: "networkidle" });
const inGifts = await page.getByText(targetName.trim()).count();
check("the claim appears in the guest's gift list", inGifts > 0);

const releaseButton = page.getByRole("button", { name: /^Release$/ }).first();
await releaseButton.click();
await page.waitForTimeout(1200);
await page.goto(`${BASE}${LIST}`, { waitUntil: "networkidle" });
const backAvailable = await page.getByRole("button", { name: /I'll get this/i }).count();
check("releasing puts it back on the list", backAvailable === availableBefore, `${backAvailable}`);

// -------------------------------------------------- item page + share modal
await page.goto(`${BASE}${LIST}`, { waitUntil: "networkidle" });
const itemHref = await page.locator("article a").first().getAttribute("href");
await page.locator("article a").first().click();
await page
  .getByRole("dialog")
  .waitFor({ state: "visible", timeout: 20000 })
  .catch(() => {});
const dialogOpen = await page.getByRole("dialog").count();
check("clicking an item opens it in place", dialogOpen > 0);
check("the list stays underneath the item", page.url().includes("/i/"));
const whyShown = await page.getByText(/Why Hunter wants this/i).count();
check("the item view leads with why they want it", whyShown > 0);

// A direct visit to the same address is a full page, not a modal.
const direct = await browser.newContext();
const directPage = await direct.newPage();
await directPage.goto(BASE + itemHref, { waitUntil: "networkidle" });
check("the same link opens as a full page on a cold visit", (await directPage.getByRole("dialog").count()) === 0);
check("the full item page renders the item", (await directPage.locator("h1").count()) > 0);

// ------------------------------- claiming from inside the item view
// Regression guard: this used to open a second overlay on top of the first,
// and two scrims turned everything behind them black.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const inner = await ctx.newPage();
  await inner.goto(`${BASE}/hunter/graduation`, { waitUntil: "domcontentloaded" });
  await inner.waitForTimeout(1200);
  const card = inner
    .locator("article")
    .filter({ has: inner.getByRole("button", { name: /I.ll get this/i }) })
    .first();
  const name = (await card.locator("h3").innerText()).trim();
  await card.locator("a").first().click();
  await inner.getByRole("dialog").waitFor({ timeout: 20000 });
  await inner.waitForTimeout(800);
  await inner.getByRole("dialog").getByRole("button", { name: /I.ll get this/i }).click();
  await inner.waitForTimeout(800);
  const overlays = await inner.getByRole("dialog").count();
  check("claiming from the item view stays in one overlay", overlays === 1, `${overlays} dialogs`);
  check("the item is still readable while claiming", (await inner.getByText(name).count()) > 0);
  await inner.locator('form button[type="submit"]').last().click();
  await inner.getByText(/is held for you/i).waitFor({ timeout: 20000 });
  check("the confirmation appears in place", true);
  check("it did not go blank", (await inner.locator("body").innerText()).length > 400);
  await ctx.close();
}
check("no uncaught client errors", errors.length === 0, errors.join(" | "));

await browser.close();
process.stdout.write(
  failures === 0
    ? `\nGift flow verified end to end.\n`
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
