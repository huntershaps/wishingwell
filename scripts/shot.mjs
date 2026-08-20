/**
 * Screenshots one or more routes at a given width.
 *
 *   node scripts/shot.mjs /hunter/graduation                  (desktop)
 *   node scripts/shot.mjs --w 390 --full /hunter/graduation   (phone, full page)
 *   node scripts/shot.mjs --as hunter /dashboard              (signed in)
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUT =
  process.env.SHOT_DIR ??
  "C:/Users/15613/AppData/Local/Temp/claude/C--Users-15613-OneDrive-Documents-claude-projects/749d8d6b-b027-45ff-87a0-0e2ccca6c833/scratchpad/shots";
const BASE = process.env.BASE ?? "http://localhost:3040";

const args = process.argv.slice(2);
let width = 1440;
let height = 900;
let full = false;
let as = null;
let wait = 900;
const routes = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--w") width = Number(args[++i]);
  else if (args[i] === "--h") height = Number(args[++i]);
  else if (args[i] === "--full") full = true;
  else if (args[i] === "--as") as = args[++i];
  else if (args[i] === "--wait") wait = Number(args[++i]);
  else routes.push(args[i]);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  reducedMotion: process.env.MOTION === "on" ? "no-preference" : "reduce",
  isMobile: width < 700,
  hasTouch: width < 700,
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));

if (as) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', `${as}@wishwell.app`);
  await page.fill('input[name="password"]', "wishwell");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|gifts|settings/, { timeout: 15000 }).catch(() => {});
}

for (const route of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(wait);
  if (full) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(full ? 700 : 0);
  if (full) await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(full ? 400 : 0);
  const name = `${route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}-${width}${full ? "-full" : ""}.png`;
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  process.stdout.write(`${path.join(OUT, name)}\n`);
}

if (errors.length) process.stdout.write(`\nconsole errors:\n${[...new Set(errors)].join("\n")}\n`);
await browser.close();
