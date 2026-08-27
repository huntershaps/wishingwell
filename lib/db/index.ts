import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { DATA_DIR } from "../paths";
import { SCHEMA } from "./schema";

declare global {
  // Reused across hot reloads in development so we don't leak connections.
  var __wishwellDb: Database.Database | undefined;
}

function open(): Database.Database {
  const dir = DATA_DIR;
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const db = new Database(path.join(/*turbopackIgnore: true*/ dir, "wishwell.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

export const db: Database.Database = globalThis.__wishwellDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__wishwellDb = db;

export const now = () => Date.now();
export const id = () => randomUUID();
export const token = (bytes = 16) => randomBytes(bytes).toString("base64url");

/** Runs `fn` inside an IMMEDIATE transaction so writers serialise properly. */
export function tx<T>(fn: () => T): T {
  const run = db.transaction(fn);
  return run.immediate();
}

export type Row = Record<string, unknown>;
