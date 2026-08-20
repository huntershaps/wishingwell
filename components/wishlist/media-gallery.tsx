"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Media } from "@/lib/types";

/**
 * One swipeable strip of media that works the same on a phone and a desktop:
 * thumbnails scroll it, a swipe scrolls it, and the active frame is tracked
 * from the scroll position rather than kept in two places.
 */
export function MediaGallery({
  media,
  name,
  blurs,
  dimmed,
  maxHeight = "min(68vh, 660px)",
}: {
  media: Media[];
  name: string;
  blurs: Record<string, string | undefined>;
  dimmed?: boolean;
  maxHeight?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) setActive(index);
          }
        }
      },
      { root: node, threshold: 0.6 },
    );
    node.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [media.length]);

  function show(index: number) {
    const node = scroller.current;
    const target = node?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  if (media.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center border border-dashed border-rule-strong">
        <span className="label">No photo yet</span>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={scroller}
        className="scroll-x flex w-full"
        role="group"
        aria-roledescription="carousel"
        aria-label={`${name} media`}
      >
        {media.map((m, index) => (
          <div
            key={m.id}
            data-index={index}
            className="relative w-full shrink-0 snap-start bg-bg-sunk"
            style={{
              aspectRatio: m.kind === "video" ? "3 / 4" : "4 / 3",
              // A phone-shaped video would otherwise run past the fold on its own.
              maxHeight,
            }}
            aria-label={`${index + 1} of ${media.length}`}
          >
            {m.kind === "video" ? (
              <video
                className="h-full w-full object-contain"
                controls
                playsInline
                preload="metadata"
                poster={m.posterUrl ?? undefined}
                aria-label={m.alt ?? `Video about ${name}`}
              >
                <source src={m.url} type="video/mp4" />
                Your browser cannot play this video note.
              </video>
            ) : (
              <Image
                src={m.url}
                alt={m.alt ?? name}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                placeholder={blurs[m.url] ? "blur" : "empty"}
                blurDataURL={blurs[m.url]}
                priority={index === 0}
                className={`object-cover ${dimmed ? "saturate-[0.6] brightness-[0.85]" : ""}`}
              />
            )}
          </div>
        ))}
      </div>

      {media.length > 1 ? (
        <div className="mt-3 flex items-center gap-2">
          {media.map((m, index) => (
            <button
              key={m.id}
              type="button"
              onClick={() => show(index)}
              aria-label={`Show ${m.kind === "video" ? "video note" : `photo ${index + 1}`}`}
              aria-current={active === index}
              className={`relative h-14 w-14 shrink-0 overflow-hidden border transition-opacity ${
                active === index ? "border-accent opacity-100" : "border-rule opacity-55 hover:opacity-90"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.kind === "video" ? (m.posterUrl ?? m.url) : m.url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {m.kind === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                  <svg width="10" height="11" viewBox="0 0 9 10" aria-hidden>
                    <path d="M0 0l9 5-9 5z" fill="currentColor" />
                  </svg>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {media[active]?.caption ? (
        <p className="label mt-3">{media[active].caption}</p>
      ) : null}
    </div>
  );
}
