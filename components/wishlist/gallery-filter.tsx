"use client";

import { useState } from "react";

type Key = "all" | "available" | "claimed";

/**
 * Filters the wall without a round trip. The cards are server rendered and
 * carry their own state, so this only decides which ones are shown.
 */
export function GalleryFilter({
  counts,
  hideClaimed,
  children,
}: {
  counts: { all: number; available: number; claimed: number };
  hideClaimed?: boolean;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<Key>("all");

  const options: { key: Key; label: string; count: number }[] = [
    { key: "all", label: "Everything", count: counts.all },
    { key: "available", label: "Still available", count: counts.available },
    ...(hideClaimed ? [] : [{ key: "claimed" as Key, label: "Spoken for", count: counts.claimed }]),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-rule pb-3">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setActive(option.key)}
            aria-pressed={active === option.key}
            disabled={option.count === 0 && option.key !== "all"}
            className={`btn btn-sm min-h-[36px] rounded-full px-3.5 transition-colors ${
              active === option.key
                ? "bg-fg text-bg"
                : "text-muted hover:bg-[color-mix(in_oklab,var(--color-fg)_7%,transparent)] hover:text-fg"
            } disabled:opacity-35`}
          >
            {option.label}
            <span className="numeric ml-1.5 text-[12px] opacity-60">{option.count}</span>
          </button>
        ))}
      </div>

      <div data-filter={active} className="gallery-grid mt-8 sm:mt-10">
        {children}
      </div>

      <style>{`
        .gallery-grid[data-filter="available"] [data-item-state="claimed"],
        .gallery-grid[data-filter="claimed"] [data-item-state="available"] {
          display: none;
        }
      `}</style>
    </>
  );
}
