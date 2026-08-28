/**
 * Applies the schema to whatever database the environment points at: the local
 * file by default, Turso when TURSO_DATABASE_URL is set.
 *
 *   npm run migrate
 *
 * Every statement is CREATE ... IF NOT EXISTS, so running it twice is harmless.
 */
import { client, migrate } from "../lib/db";

async function main() {
  const target = process.env.TURSO_DATABASE_URL ?? "the local file";
  await migrate();

  // Cascade deletes are load-bearing for account removal, and whether they are
  // enforced is a property of the server, not of the schema. Worth knowing.
  const fk = await client.execute(`PRAGMA foreign_keys`);
  const tables = await client.execute(
    `SELECT COUNT(*) AS n FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );

  process.stdout.write(`Migrated ${target}\n`);
  process.stdout.write(`  tables:       ${tables.rows[0].n}\n`);
  process.stdout.write(`  foreign_keys: ${JSON.stringify(fk.rows[0]?.foreign_keys ?? "unknown")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
