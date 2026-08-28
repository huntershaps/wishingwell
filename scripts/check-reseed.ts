/** Proves `npm run seed` leaves real accounts alone. Run after a seed. */
import { execFileSync } from "node:child_process";
import { db, now } from "../lib/db";

async function main() {
  const T = now();
  await db.prepare(`DELETE FROM users WHERE email = 'real@example.com'`).run();
  await db.prepare(`INSERT INTO users (id,email,password_hash,created_at) VALUES ('real','real@example.com','x',?)`).run(T);
  await db.prepare(`INSERT INTO profiles (user_id,username,display_name,created_at) VALUES ('real','realperson','Real',?)`).run(T);
  await db.prepare(`INSERT INTO settings (user_id) VALUES ('real')`).run();
  await db.prepare(`INSERT INTO wishlists (id,user_id,slug,title,share_token,created_at,updated_at) VALUES ('real-list','real','birthday','Birthday','tok',?,?)`).run(T, T);
  await db.prepare(`INSERT INTO items (id,wishlist_id,name,created_at,updated_at) VALUES ('real-item','real-list','A real present',?,?)`).run(T, T);

  const before = await db.prepare(`SELECT COUNT(*) AS n FROM items WHERE wishlist_id != 'real-list'`).get() as { n: number };

  execFileSync("npx", ["tsx", "scripts/seed.ts"], { stdio: "pipe", shell: true });

  const after = await db.prepare(`SELECT COUNT(*) AS n FROM items WHERE wishlist_id != 'real-list'`).get() as { n: number };
  const realUser = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE id = 'real'`).get() as { n: number };
  const realItem = await db.prepare(`SELECT COUNT(*) AS n FROM items WHERE id = 'real-item'`).get() as { n: number };
  const dupes = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@wishwell.app'`).get() as { n: number };

  const checks: [string, boolean, string][] = [
    ["the demo is restored, not duplicated", after.n === before.n, `${before.n} then ${after.n}`],
    ["exactly five demo accounts remain", dupes.n === 5, `${dupes.n}`],
    ["the real account survives a reseed", realUser.n === 1, ""],
    ["the real list's item survives", realItem.n === 1, ""],
  ];
  let bad = 0;
  for (const [name, ok, detail] of checks) {
    process.stdout.write(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
    if (!ok) bad++;
  }
  await db.prepare(`DELETE FROM users WHERE id = 'real'`).run();
  await db.prepare(`DELETE FROM wishlists WHERE id = 'real-list'`).run();
  await db.prepare(`DELETE FROM items WHERE id = 'real-item'`).run();
  process.stdout.write(bad ? `\n${bad} problem(s)\n` : `\nA reseed restores the demo and spares real accounts.\n`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
