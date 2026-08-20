import "server-only";
import fs from "node:fs";
import path from "node:path";

type Credit = { blur?: string; photographer?: string; alt?: string; ratio?: number };

let cache: Record<string, Credit> | null = null;

function credits(): Record<string, Credit> {
  if (cache) return cache;
  try {
    cache = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "media", "credits.json"), "utf8"),
    );
  } catch {
    cache = {};
  }
  return cache!;
}

/** Tiny inlined JPEG used as the blur-up placeholder for a demo photograph. */
export function blurFor(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const key = url.split("/").pop()?.replace(/\.(jpg|jpeg|png|mp4)$/i, "");
  return key ? credits()[key]?.blur : undefined;
}

export function photographerFor(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const key = url.split("/").pop()?.replace(/\.(jpg|jpeg|png|mp4)$/i, "");
  return key ? credits()[key]?.photographer : undefined;
}
