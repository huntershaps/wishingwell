import Image from "next/image";
import Link from "next/link";
import { blurFor } from "@/lib/blur";
import { money, PRIORITY } from "@/lib/format";
import { RATIO, type Variant } from "@/lib/layout";
import type { Item } from "@/lib/types";
import { HoldTag, Ribbon } from "@/components/ui/bits";
import { GiftButton } from "./gift-button";

function firstImage(item: Item) {
  return item.media.find((m) => m.kind === "image") ?? null;
}
function video(item: Item) {
  return item.media.find((m) => m.kind === "video") ?? null;
}

function Frame({
  item,
  variant,
  priority,
}: {
  item: Item;
  variant: Variant;
  priority?: boolean;
}) {
  const image = firstImage(item);
  const clip = video(item);
  const claimed = item.giftState === "reserved" || item.giftState === "purchased";
  const src = image?.url ?? clip?.posterUrl ?? null;

  return (
    // On a phone the photographs run to both edges — a list should feel like
    // something you are looking through, not a form you are reading.
    <span
      className="relative -mx-5 block w-[calc(100%+2.5rem)] overflow-hidden bg-bg-sunk sm:mx-0 sm:w-full"
      style={{ aspectRatio: RATIO[variant] }}
    >
      {src ? (
        <Image
          src={src}
          alt={image?.alt ?? item.name}
          fill
          sizes={
            variant === "feature"
              ? "(max-width: 640px) 100vw, 60vw"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          }
          placeholder={blurFor(src) ? "blur" : "empty"}
          blurDataURL={blurFor(src)}
          priority={priority}
          className={`object-cover transition-[transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035] ${
            claimed && !item.reservedByViewer ? "saturate-[0.55] brightness-[0.82]" : ""
          }`}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-faint">
          <span className="label">No photo yet</span>
        </span>
      )}

      <span
        aria-hidden
        className="absolute inset-0 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-fg)_14%,transparent)]"
      />

      {clip ? (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(12,8,10,0.62)] px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
            <path d="M0 0l9 5-9 5z" fill="currentColor" />
          </svg>
          Video note
        </span>
      ) : null}

      {claimed ? (
        <span className="absolute bottom-3 left-3">
          <HoldTag
            state={item.giftState === "purchased" ? "purchased" : "reserved"}
            mine={item.reservedByViewer}
          />
        </span>
      ) : null}
    </span>
  );
}

function WallLabel({ item, size = "sm" }: { item: Item; size?: "sm" | "lg" }) {
  const price = money(item.priceCents, item.currency);
  return (
    <p className={`label ${size === "lg" ? "mt-3" : "mt-2"} flex flex-wrap items-center gap-x-2.5 gap-y-1`}>
      {price ? <span className="numeric text-fg">{price}</span> : <span>Price not set</span>}
      {item.store ? (
        <>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span>{item.store}</span>
        </>
      ) : null}
      {item.priority === "dream" || item.priority === "high" ? (
        <>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span className="text-accent">{PRIORITY[item.priority].short}</span>
        </>
      ) : null}
    </p>
  );
}

export function ItemCard({
  item,
  variant,
  href,
  index,
}: {
  item: Item;
  variant: Variant;
  href: string;
  index: number;
}) {
  const claimed = item.giftState === "reserved" || item.giftState === "purchased";

  if (variant === "feature") {
    const flip = index % 2 === 1;
    return (
      <article className="group grid gap-6 sm:gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
        <Link
          href={href}
          className={`block lg:col-span-7 ${flip ? "lg:order-2" : ""}`}
          aria-label={`Open ${item.name}`}
        >
          <Frame item={item} variant="feature" priority={index < 2} />
        </Link>
        <div className={`lg:col-span-5 ${flip ? "lg:order-1" : ""}`}>
          <Ribbon>{item.priority === "dream" ? "The dream item" : "Featured"}</Ribbon>
          <h3 className="display mt-3 text-[clamp(1.75rem,4vw,2.5rem)] balance">
            <Link href={href} className="transition-colors hover:text-accent">
              {item.name}
            </Link>
          </h3>
          {item.whyWant ? (
            <blockquote className="voice-em mt-4 border-l border-rule-strong pl-4 text-[17px] leading-[1.6] text-muted pretty">
              {item.whyWant.length > 220 ? `${item.whyWant.slice(0, 215).trimEnd()}…` : item.whyWant}
            </blockquote>
          ) : null}
          <WallLabel item={item} size="lg" />
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <GiftButton item={item} quiet />
            <Link href={href} className="btn btn-outline btn-sm">
              View details
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col">
      <Link href={href} className="block" aria-label={`Open ${item.name}`}>
        <Frame item={item} variant={variant} priority={index < 3} />
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="display text-[17px] leading-tight balance sm:text-[18px]">
          <Link href={href} className="transition-colors hover:text-accent">
            {item.name}
          </Link>
        </h3>
        <WallLabel item={item} />
        {variant === "tall" && item.whyWant ? (
          <p className="voice-em mt-2.5 line-clamp-3 text-[14.5px] leading-[1.55] text-muted pretty">
            {item.whyWant}
          </p>
        ) : null}
        {/* The tag on the photograph already says it is claimed, so the button
            goes quiet rather than repeating it. */}
        <div className={claimed ? "" : "mt-3 flex items-center gap-2 pt-1"}>
          <GiftButton item={item} compact quiet />
        </div>
      </div>
    </article>
  );
}
