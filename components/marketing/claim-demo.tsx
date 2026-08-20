"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/client-hooks";
import { HoldTag } from "@/components/ui/bits";

/**
 * The hero states the mechanic instead of describing it: an item sits on the
 * wall, someone claims it, and a paper tag is tied on. Replay is manual, so it
 * happens once and then leaves you alone.
 */
export function ClaimDemo({ blurDataURL }: { blurDataURL?: string }) {
  const reduced = usePrefersReducedMotion();
  const [claimed, setClaimed] = useState(false);
  const animate = !reduced;

  useEffect(() => {
    const timer = setTimeout(() => setClaimed(true), reduced ? 0 : 1900);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <figure className="relative">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-bg-sunk sm:aspect-[4/3] lg:aspect-[4/5]">
        <Image
          src="/media/sony-a7.jpg"
          alt="A Sony mirrorless camera on a dark table"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          placeholder={blurDataURL ? "blur" : "empty"}
          blurDataURL={blurDataURL}
          className={`object-cover transition-[filter] duration-700 ${
            claimed ? "saturate-[0.72] brightness-[0.9]" : ""
          }`}
        />
        <span
          aria-hidden
          className="absolute inset-0 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-fg)_16%,transparent)]"
        />
        {claimed ? (
          <span className="absolute bottom-4 left-4">
            <HoldTag state="reserved" entering={animate} />
          </span>
        ) : null}
      </div>

      <figcaption className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="display text-[19px]">Sony α7 IV</p>
          <p className="label mt-1.5">
            <span className="numeric text-fg">$2,498</span>
            <span aria-hidden className="mx-2 opacity-40">·</span>
            <span>The dream item</span>
          </p>
        </div>
        <p
          className={`text-right text-[13px] leading-tight transition-colors duration-500 ${
            claimed ? "text-muted" : "text-faint"
          }`}
        >
          {claimed ? (
            <>
              Someone is getting it.
              <br />
              <span className="text-faint">Hunter will never know who.</span>
            </>
          ) : (
            <>
              Nobody has claimed it.
              <br />
              <span className="text-faint">Yet.</span>
            </>
          )}
        </p>
      </figcaption>

      {claimed ? (
        <button
          type="button"
          onClick={() => {
            setClaimed(false);
            setTimeout(() => setClaimed(true), 1400);
          }}
          className="label mt-3 transition-colors hover:text-fg"
        >
          Play it again
        </button>
      ) : null}
    </figure>
  );
}
