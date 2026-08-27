/**
 * Puts the demo world back the way the seed left it, without touching anybody
 * real.
 *
 * Every seeded account has a @wishwell.app address, and the template database
 * baked into the image contains those accounts and nothing else. So a reset is:
 * delete the rows that belong to the demo people, copy the demo people back in.
 * Real accounts are matched by neither step and come through untouched.
 *
 *   node scripts/reset-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = process.env.WISHWELL_DATA_DIR ?? "/data";
const template = process.env.WISHWELL_SEED_DB ?? "/app/seed/wishwell.db";
const live = path.join(dataDir, "wishwell.db");

if (!fs.existsSync(live)) throw new Error(`No database at ${live}`);
if (!fs.existsSync(template)) throw new Error(`No demo template at ${template}`);

// Parents before children: every row's references exist by the time it lands.
const TABLES = [
  "users", "profiles", "settings", "guests", "wishlists",
  "items", "item_media", "reservations", "notifications", "wishlist_events",
];

const db = new Database(live);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.prepare(`ATTACH DATABASE ? AS tpl`).run(template);

const kept = db.prepare(`SELECT count(*) AS n FROM users WHERE email NOT LIKE '%@wishwell.app'`).get();

db.transaction(() => {
  // Cascades take the demo profiles, lists, items, claims and notifications.
  db.prepare(`DELETE FROM main.users WHERE email LIKE '%@wishwell.app'`).run();
  db.prepare(`DELETE FROM main.guests WHERE token IN (SELECT token FROM tpl.guests)`).run();
  for (const t of TABLES) db.prepare(`INSERT INTO main.${t} SELECT * FROM tpl.${t}`).run();
}).immediate();

db.pragma("wal_checkpoint(TRUNCATE)");
db.close();

console.log(`[wishwell] demo reset; ${kept.n} real account(s) left alone`);
