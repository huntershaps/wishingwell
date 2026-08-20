import Link from "next/link";
import { blurFor } from "@/lib/blur";
import { hostFromUrl, longDate, money, PRIORITY } from "@/lib/format";
import type { Item } from "@/lib/types";
import { HoldTag } from "@/components/ui/bits";
import { GiftButton } from "./gift-button";
import { MediaGallery } from "./media-gallery";

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-t border-rule py-2.5">
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-[14.5px]">{value}</dd>
    </div>
  );
}

export function ItemDetail({
  item,
  ownerFirstName,
  compact,
}: {
  item: Item;
  ownerFirstName: string;
  compact?: boolean;
}) {
  const price = money(item.priceCents, item.currency);
  const claimed = item.giftState === "reserved" || item.giftState === "purchased";
  const blurs = Object.fromEntries(item.media.map((m) => [m.url, blurFor(m.url)]));
  const host = hostFromUrl(item.url);

  return (
    <div className={compact ? "grid gap-6 sm:grid-cols-2 sm:gap-8" : "grid gap-8 lg:grid-cols-12 lg:gap-14"}>
      <div className={compact ? "sm:sticky sm:top-0 sm:self-start" : "lg:col-span-7"}>
        <MediaGallery
          media={item.media}
          name={item.name}
          blurs={blurs}
          dimmed={claimed && !item.reservedByViewer}
          maxHeight={compact ? "min(46vh, 420px)" : "min(68vh, 660px)"}
        />
      </div>

      <div className={compact ? "" : "lg:col-span-5"}>
        {claimed ? (
          <div className="mb-5">
            <HoldTag
              state={item.giftState === "purchased" ? "purchased" : "reserved"}
              mine={item.reservedByViewer}
            />
            <p className="mt-3 text-[13.5px] text-muted pretty">
              {item.reservedByViewer
                ? "You claimed this one. Manage it any time under Gifts I'm Getting."
                : item.giftState === "purchased"
                  ? "Someone has already bought this. Pick something else so nothing is doubled up."
                  : `Someone is already planning to get this. ${ownerFirstName} doesn't know, and won't.`}
            </p>
          </div>
        ) : null}

        {!compact ? (
          <h1 className="display text-[clamp(1.75rem,4vw,2.75rem)] balance">{item.name}</h1>
        ) : (
          <h3 className="display hidden text-[clamp(1.5rem,5vw,2rem)] balance sm:block">{item.name}</h3>
        )}

        <p className="label mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {price ? <span className="numeric text-fg text-[15px]">{price}</span> : null}
          {item.store ? (
            <>
              <span aria-hidden className="opacity-40">·</span>
              <span>{item.store}</span>
            </>
          ) : null}
          <span aria-hidden className="opacity-40">·</span>
          <span className={item.priority === "dream" || item.priority === "high" ? "text-accent" : ""}>
            {PRIORITY[item.priority].label}
          </span>
        </p>

        {item.whyWant ? (
          <section className="mt-7">
            <h4 className="label">Why {ownerFirstName} wants this</h4>
            <blockquote className="voice mt-3 border-l-2 border-accent pl-4 text-[clamp(1.0625rem,2vw,1.1875rem)] leading-[1.6] pretty">
              {item.whyWant}
            </blockquote>
          </section>
        ) : null}

        {item.description ? (
          <p className="mt-6 text-[15px] leading-[1.6] text-muted pretty">{item.description}</p>
        ) : null}

        <div className="mt-7 flex flex-col gap-2.5">
          <GiftButton item={item} block mode="inline" />
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline w-full"
            >
              View at {host ?? "the store"}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none">
                <path
                  d="M4 2h6v6M10 2L2.5 9.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </a>
          ) : null}
        </div>

        <dl className="mt-8">
          {item.size ? <Spec label="Size" value={item.size} /> : null}
          {item.color ? <Spec label="Colour" value={item.color} /> : null}
          {item.variant ? <Spec label="Variation" value={item.variant} /> : null}
          {item.category ? <Spec label="Category" value={item.category} /> : null}
          {item.tags.length ? (
            <Spec
              label="Tags"
              value={
                <span className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </span>
              }
            />
          ) : null}
          <Spec label="Added" value={longDate(item.createdAt)} />
        </dl>

        {item.reservedByViewer ? (
          <Link href="/gifts" className="link-underline mt-6 inline-block text-[14px]">
            Manage this gift
          </Link>
        ) : null}
      </div>
    </div>
  );
}
