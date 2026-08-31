import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { DATA_DIR } from "../paths";
import { SCHEMA } from "./schema";

/**
 * One driver, three places to run.
 *
 * libSQL is SQLite, so the same client talks to a plain file during development
 * and to Turso over the network in production. The statement wrapper below keeps
 * the shape the application already used — `db.prepare(sql).get(args)` — and only
 * makes it asynchronous, because a database reached over a network cannot be
 * anything else.
 */

export type Row = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Statement = {
  get<T = any>(...args: InValue[]): Promise<T | undefined>;
  all<T = any>(...args: InValue[]): Promise<T[]>;
  run(...args: InValue[]): Promise<{ changes: number; lastInsertRowid?: bigint }>;
};

export type Queryable = { prepare(sql: string): Statement };

const remoteUrl = process.env.TURSO_DATABASE_URL;
const isRemote = Boolean(remoteUrl);

declare global {
  // Reused across hot reloads in development so we don't leak connections.
  var __wishwellClient: Client | undefined;
  var __wishwellReady: Promise<void> | undefined;
}

function connect(): Client {
  if (remoteUrl) {
    // A libsql:// URL makes the client open a WebSocket and hold it. That is the
    // right shape for a long-lived server and the wrong one for a serverless
    // function, where it fails outright: Turso answers the upgrade with a 400 and
    // every query dies with it, while the same credentials work over HTTP. Asking
    // for https:// selects the request-per-query transport, which is also what a
    // function that may not outlive the request should be using.
    const url = remoteUrl.replace(/^libsql:\/\//, "https://");
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  fs.mkdirSync(/*turbopackIgnore: true*/ DATA_DIR, { recursive: true });
  // libSQL wants a URL, and a Windows path with backslashes is not one.
  const file = path.join(/*turbopackIgnore: true*/ DATA_DIR, "wishwell.db").split(path.sep).join("/");
  return createClient({ url: `file:${file}` });
}

export const client: Client = globalThis.__wishwellClient ?? connect();
if (process.env.NODE_ENV !== "production") globalThis.__wishwellClient = client;

/**
 * A local database creates itself on first use, the way it always did. A remote
 * one is migrated deliberately with `npm run migrate`, so no cold start pays for
 * twenty DDL statements it does not need.
 */
async function ready(): Promise<void> {
  if (isRemote) return;
  globalThis.__wishwellReady ??= (async () => {
    await client.executeMultiple(
      `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;`,
    );
    await client.executeMultiple(SCHEMA);
  })();
  await globalThis.__wishwellReady;
}

function statementsFrom(executor: Client | Transaction): (sql: string) => Statement {
  return (sql: string) => ({
    async get<T = any>(...args: InValue[]) {
      await ready();
      const rs = await executor.execute({ sql, args });
      return rs.rows[0] as T | undefined;
    },
    async all<T = any>(...args: InValue[]) {
      await ready();
      const rs = await executor.execute({ sql, args });
      return rs.rows as T[];
    },
    async run(...args: InValue[]) {
      await ready();
      const rs = await executor.execute({ sql, args });
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
    },
  });
}

export const db: Queryable & { exec(sql: string): Promise<void> } = {
  prepare: statementsFrom(client),
  async exec(sql: string) {
    await ready();
    await client.executeMultiple(sql);
  },
};

export const now = () => Date.now();
export const id = () => randomUUID();
export const token = (bytes = 16) => randomBytes(bytes).toString("base64url");

/**
 * Runs `fn` inside a write transaction, which libSQL begins as IMMEDIATE, so
 * writers serialise instead of racing. The callback is handed its own handle:
 * statements sent to the ambient `db` would run outside the transaction and
 * quietly lose the atomicity this exists to provide.
 */
export async function tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T> {
  await ready();
  const transaction = await client.transaction("write");
  try {
    const result = await fn({ prepare: statementsFrom(transaction) });
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback().catch(() => {});
    throw err;
  } finally {
    transaction.close();
  }
}

/** Applies the schema. Used by `npm run migrate` and by the seed. */
export async function migrate(): Promise<void> {
  await client.executeMultiple(SCHEMA);
}
