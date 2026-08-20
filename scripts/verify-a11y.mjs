/**
 * Runs axe over every significant surface, signed in and out, plus a keyboard
 * pass over the gift flow.
 *
 *   node scripts/verify-a11y.mjs
 */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.BASE ?? "http://localhost:3040";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/hunter", "/hunter/graduation"];
const PRIVATE_ROUTES = ["/dashboard", "/dashboard/new", "/gifts", "/notifications", "/settings"];

let violations = 0;
const browser = await chromium.launch();

async function audit(page, route, width) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = results.violations;
  if (found.length === 0) {
    process.stdout.write(`  ok   ${route} @${width}\n`);
  } else {
    violations += found.length;
    process.stdout.write(`  FAIL ${route} @${width}\n`);
    for (const v of found) {
      process.stdout.write(
        `       ${v.id} (${v.impact}) — ${v.nodes.length}× — ${v.help}\n         ${v.nodes[0]?.target?.join(" ")}\n`,
      );
    }
  }
}

for (const width of [1440, 390]) {
  process.stdout.write(`\nSigned out @${width}\n`);
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 } });
  const page = await ctx.newPage();
  for (const route of PUBLIC_ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await audit(page, route, width);
  }

  process.stdout.write(`\nSigned in @${width}\n`);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "hunter@wishwell.app");
  await page.fill('input[name="password"]', "wishwell");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  for (const route of PRIVATE_ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await audit(page, route, width);
  }

  // The list editor, and a dialog while it is open.
  const editHref = await page
    .goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
    .then(() => page.getByRole("link", { name: "Edit" }).first().getAttribute("href"));
  if (editHref) {
    await page.goto(`${BASE}${editHref}`, { waitUntil: "networkidle" });
    await audit(page, editHref, width);
    await page.getByRole("button", { name: "Add item" }).first().click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(700);
    await audit(page, `${editHref} (composer open)`, width);
  }
  await ctx.close();
}

// ------------------------------------------------------------ keyboard pass
process.stdout.write(`\nKeyboard\n`);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/hunter/photography`, { waitUntil: "networkidle" });

await page.getByRole("button", { name: /I'll get this/i }).first().focus();
await page.keyboard.press("Enter");
await page.getByRole("dialog").waitFor({ timeout: 10000 });
process.stdout.write("  ok   a claim can be opened from the keyboard\n");

const focusInDialog = await page.evaluate(() =>
  document.querySelector('[role="dialog"]')?.contains(document.activeElement),
);
if (!focusInDialog) violations += 1;
process.stdout.write(
  `  ${focusInDialog ? "ok  " : "FAIL"} focus moves into the dialog\n`,
);

// Tab all the way round and confirm focus never escapes the dialog.
let escaped = false;
for (let i = 0; i < 25; i++) {
  await page.keyboard.press("Tab");
  const inside = await page.evaluate(() =>
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  if (!inside) escaped = true;
}
if (escaped) violations += 1;
process.stdout.write(`  ${escaped ? "FAIL" : "ok  "} focus stays trapped while it is open\n`);

await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const closed = (await page.getByRole("dialog").count()) === 0;
if (!closed) violations += 1;
process.stdout.write(`  ${closed ? "ok  " : "FAIL"} escape closes it\n`);

const returned = await page.evaluate(
  () => document.activeElement?.textContent?.includes("get this") ?? false,
);
if (!returned) violations += 1;
process.stdout.write(`  ${returned ? "ok  " : "FAIL"} focus returns to the button that opened it\n`);

await browser.close();
process.stdout.write(
  violations === 0 ? `\nNo accessibility violations found.\n` : `\n${violations} issue(s) found.\n`,
);
process.exit(violations === 0 ? 0 : 1);
