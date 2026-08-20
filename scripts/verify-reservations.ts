/**
 * Checks the two promises the product is built on:
 *   1. one live claim per item, even under a simultaneous race
 *   2. an owner in surprise mode is never told which item moved
 *
 *   npx tsx scripts/verify-reservations.ts
 */
import { db, id, now } from "../lib/db";
import { getItems, getListStats } from "../lib/queries";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    process.stdout.write(`  ok   ${name}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  FAIL ${name}${detail ? ` — ${detail}` : ""}\n`);
  }
}

const item = db
  .prepare(
    `SELECT i.id, i.name FROM items i
       JOIN wishlists w ON w.id = i.wishlist_id
      WHERE NOT EXISTS (SELECT 1 FROM reservations r
                         WHERE r.item_id = i.id AND r.status IN ('reserved','purchased'))
      LIMIT 1`,
  )
  .get() as { id: string; name: string };

const buyers = db.prepare(`SELECT id FROM users LIMIT 2`).all() as { id: string }[];

process.stdout.write(`\nRace: two buyers claiming "${item.name}" at the same moment\n`);

function claim(buyerId: string) {
  db.prepare(
    `INSERT INTO reservations (id, item_id, buyer_user_id, status, reserved_at)
     VALUES (?, ?, ?, 'reserved', ?)`,
  ).run(id(), item.id, buyerId, now());
}

let first = false;
let second = false;
try {
  claim(buyers[0].id);
  first = true;
} catch {}
try {
  claim(buyers[1].id);
  second = true;
} catch {}

check("exactly one claim succeeds", first !== second, `first=${first} second=${second}`);

const live = db
  .prepare(
    `SELECT COUNT(*) AS n FROM reservations WHERE item_id = ? AND status IN ('reserved','purchased')`,
  )
  .get(item.id) as { n: number };
check("the database holds one live claim", live.n === 1, `found ${live.n}`);

// Releasing should free the item for the next person.
db.prepare(
  `UPDATE reservations SET status = 'released', released_at = ?
    WHERE item_id = ? AND status = 'reserved'`,
).run(now(), item.id);

let afterRelease = false;
try {
  claim(buyers[1].id);
  afterRelease = true;
} catch {}
check("a released item can be claimed again", afterRelease);

// A purchased claim still blocks everyone else.
db.prepare(
  `UPDATE reservations SET status = 'purchased', purchased_at = ?
    WHERE item_id = ? AND status = 'reserved'`,
).run(now(), item.id);
let afterPurchase = false;
try {
  claim(buyers[0].id);
  afterPurchase = true;
} catch {}
check("a bought item cannot be claimed", !afterPurchase);

// Leave the demo data as we found it.
db.prepare(`DELETE FROM reservations WHERE item_id = ?`).run(item.id);

process.stdout.write(`\nSurprise mode: what an owner is allowed to know\n`);

const owner = db
  .prepare(
    `SELECT u.id, p.display_name AS name, s.surprise_mode AS surprise
       FROM users u JOIN profiles p ON p.user_id = u.id JOIN settings s ON s.user_id = u.id
      WHERE p.username = 'hunter'`,
  )
  .get() as { id: string; name: string; surprise: number };

check("hunter has surprise mode on", owner.surprise === 1);

const lists = db
  .prepare(`SELECT id, title FROM wishlists WHERE user_id = ?`)
  .all(owner.id) as { id: string; title: string }[];

let ownerLeak = 0;
let activityTotal = 0;
for (const list of lists) {
  const asOwner = getItems(list.id, {
    viewer: { userId: owner.id, guestToken: null },
    isOwner: true,
    surpriseMode: true,
  });
  ownerLeak += asOwner.filter((i) => i.giftState !== "hidden").length;
  activityTotal += getListStats(list.id).giftActivityCount;
}

check("no item leaks its gift state to the owner", ownerLeak === 0, `${ownerLeak} leaked`);
check("the owner still sees that activity exists", activityTotal > 0, `${activityTotal} claimed`);

const asVisitor = getItems(lists[0].id, {
  viewer: { userId: null, guestToken: null },
  isOwner: false,
  surpriseMode: true,
});
check(
  "a visitor sees real availability",
  asVisitor.every((i) => i.giftState !== "hidden"),
);
check(
  "a visitor is never told who claimed something",
  asVisitor.every((i) => !i.reservedByViewer && i.reservation === undefined),
);

process.stdout.write(
  failures === 0 ? `\nAll reservation guarantees hold.\n` : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
