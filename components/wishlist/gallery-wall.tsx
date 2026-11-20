"use client";

import { useId, useMemo, useState } from "react";
import { planLayout, SPAN } from "@/lib/layout";
import {
  inBand,
  PRICE_BANDS,
  sortItems,
  type PriceBand,
  type Show,
  type Sort,
} from "@/lib/price";
import type { Item } from "@/lib/types";
import { Reveal } from "@/components/ui/reveal";
import { ItemCard } from "./item-card";

const isClaimed = (item: Item) => item.giftState === "reserved" || item.giftState === "purchased";

function matchesShow(item: Item, show: Show) {
  if (show === "available") return !isClaimed(item);
  if (show === "claimed") return isClaimed(item);
  return true;
}

function Chevron() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The wall, with the three ways a visitor can narrow it: what is still
 * available, what it costs, and in what order. Everything happens in the
 * browser, and the choice is written into the address so a link to "everything
 * under $25" opens that way for whoever it is sent to.
 *
 * The layout is planned again from whatever is showing, so a filtered wall
 * composes as cleanly as the whole one instead of leaving holes.
 */
export function GalleryWall({
  items,
  blurs,
  basePath,
  ownerFirstName,
  hideClaimed,
  initial,
}: {
  items: Item[];
  blurs: Record<string, string>;
  basePath: string;
  ownerFirstName: string;
  hideClaimed?: boolean;
  initial: { price: PriceBand; sort: Sort; show: Show };
}) {
  const [show, setShow] = useState<Show>(
    hideClaimed && initial.show === "claimed" ? "all" : initial.show,
  );
  const [price, setPrice] = useState<PriceBand>(initial.price);
  const [sort, setSort] = useState<Sort>(initial.sort);
  const priceId = useId();
  const sortId = useId();

  function update(next: { show?: Show; price?: PriceBand; sort?: Sort }) {
    const s = next.show ?? show;
    const p = next.price ?? price;
    const o = next.sort ?? sort;
    if (next.show) setShow(next.show);
    if (next.price) setPrice(next.price);
    if (next.sort) setSort(next.sort);

    // Native history, so the address changes without asking the server to
    // render the page again (which would also count as another visit).
    const params = new URLSearchParams(window.location.search);
    const put = (key: string, value: string, fallback: string) =>
      value === fallback ? params.delete(key) : params.set(key, value);
    put("show", s, "all");
    put("price", p, "any");
    put("sort", o, "owner");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  const showCounts = useMemo(() => {
    const priced = items.filter((i) => inBand(i, price));
    return {
      all: priced.length,
      available: priced.filter((i) => !isClaimed(i)).length,
      claimed: priced.filter(isClaimed).length,
    };
  }, [items, price]);

  const bandCounts = useMemo(() => {
    const shown = items.filter((i) => matchesShow(i, show));
    return Object.fromEntries(
      (["any", ...PRICE_BANDS.map((b) => b.key)] as PriceBand[]).map((key) => [
        key,
        shown.filter((i) => inBand(i, key)).length,
      ]),
    ) as Record<PriceBand, number>;
  }, [items, show]);

  const visible = useMemo(
    () => sortItems(items.filter((i) => matchesShow(i, show) && inBand(i, price)), sort),
    [items, show, price, sort],
  );
  const plan = useMemo(() => planLayout(visible, { features: sort === "owner" }), [visible, sort]);

  const filtered = show !== "all" || price !== "any";
  const bandLabel = PRICE_BANDS.find((b) => b.key === price)?.label.toLowerCase();

  // "Still available" is shortened on a phone so all three fit on one line.
  const options: { key: Show; label: React.ReactNode; count: number }[] = [
    { key: "all", label: "Everything", count: showCounts.all },
    {
      key: "available",
      label: (
        <>
          <span className="sm:hidden">Available</span>
          <span className="hidden sm:inline">Still available</span>
        </>
      ),
      count: showCounts.available,
    },
    ...(hideClaimed ? [] : [{ key: "claimed" as Show, label: "Spoken for", count: showCounts.claimed }]),
  ];

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-rule pb-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div role="group" aria-label="Which items to show" className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => update({ show: option.key })}
              aria-pressed={show === option.key}
              disabled={option.count === 0 && option.key !== "all" && show !== option.key}
              className="btn btn-sm btn-pill"
            >
              {option.label}
              <span className="numeric -ml-0.5 text-[12px] opacity-60 sm:ml-0">{option.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-end sm:gap-3">
          <div className="min-w-0 sm:w-[190px]">
            <label htmlFor={priceId} className="label block pb-1.5">
              Price
            </label>
            <span className="relative block">
              <select
                id={priceId}
                value={price}
                onChange={(e) => update({ price: e.target.value as PriceBand })}
                className="field min-h-[40px] cursor-pointer appearance-none py-2 pr-9 text-[14px]"
              >
                <option value="any">Any price ({bandCounts.any})</option>
                {PRICE_BANDS.map((band) => (
                  <option key={band.key} value={band.key}>
                    {band.label} ({bandCounts[band.key]})
                  </option>
                ))}
              </select>
              <Chevron />
            </span>
          </div>
          <div className="min-w-0 sm:w-[210px]">
            <label htmlFor={sortId} className="label block pb-1.5">
              Order
            </label>
            <span className="relative block">
              <select
                id={sortId}
                value={sort}
                onChange={(e) => update({ sort: e.target.value as Sort })}
                className="field min-h-[40px] cursor-pointer appearance-none py-2 pr-9 text-[14px]"
              >
                <option value="owner">{ownerFirstName}&apos;s order</option>
                <option value="price-low">Price, low to high</option>
                <option value="price-high">Price, high to low</option>
              </select>
              <Chevron />
            </span>
          </div>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-[13.5px] text-muted">
        {filtered && visible.length === 0 ? (
          <span className="sr-only">Nothing matches those choices.</span>
        ) : null}
        {filtered && visible.length > 0 ? (
          <>
            Showing <span className="numeric text-fg">{visible.length}</span> of{" "}
            <span className="numeric">{items.length}</span>
            {bandLabel ? <> · {bandLabel}</> : null}
            {show === "available" ? <> · still available</> : null}
            {show === "claimed" ? <> · spoken for</> : null}
            <button
              type="button"
              onClick={() => update({ show: "all", price: "any" })}
              className="ml-3 rounded-sm text-fg underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-fg"
            >
              Clear filters
            </button>
          </>
        ) : null}
      </p>

      {visible.length === 0 ? (
        <div className="mt-6 border border-dashed border-rule-strong px-6 py-16 text-center">
          <h2 className="display text-[22px]">Nothing matches that</h2>
          <p className="voice mx-auto mt-2 max-w-md text-[16px] text-muted pretty">
            {show === "available" && bandLabel
              ? "Everything in that price range is already spoken for."
              : bandLabel
                ? "Nothing on this list falls in that price range."
                : "No items fit those choices."}{" "}
            Try another price, or see the whole list.
          </p>
          <button
            type="button"
            onClick={() => update({ show: "all", price: "any" })}
            className="btn btn-outline btn-sm mt-5"
          >
            Show everything
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-12 sm:mt-7 sm:grid-cols-4 sm:gap-y-14 lg:grid-cols-6">
          {plan.map(({ item, variant }, index) => (
            <Reveal
              key={item.id}
              className={SPAN[variant]}
              delay={Math.min(index, 4) * 55}
              variant={variant === "feature" ? "rise" : "mask"}
            >
              <div data-item-state={isClaimed(item) ? "claimed" : "available"}>
                <ItemCard
                  item={item}
                  variant={variant}
                  href={`${basePath}/i/${item.id}`}
                  index={index}
                  blur={blurs[item.id]}
                />
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}
