import type { Item } from "./types";

/**
 * How a visitor narrows and orders a list. Pure and shared, so the server can
 * read a shared link's filters and the wall can apply them without a round trip.
 */

export type PriceBand = "any" | "under-25" | "25-50" | "50-100" | "100-up";
export type Sort = "owner" | "price-low" | "price-high";
export type Show = "all" | "available" | "claimed";

/** Lower bound inclusive, upper bound exclusive, in cents. */
export const PRICE_BANDS: { key: Exclude<PriceBand, "any">; label: string; min: number; max: number }[] = [
  { key: "under-25", label: "Under $25", min: 0, max: 2500 },
  { key: "25-50", label: "$25 to $50", min: 2500, max: 5000 },
  { key: "50-100", label: "$50 to $100", min: 5000, max: 10000 },
  { key: "100-up", label: "$100 and up", min: 10000, max: Infinity },
];

const BAND_KEYS = new Set<string>(["any", ...PRICE_BANDS.map((b) => b.key)]);
const SORT_KEYS = new Set<string>(["owner", "price-low", "price-high"]);
const SHOW_KEYS = new Set<string>(["all", "available", "claimed"]);

/**
 * An item with no price belongs to no band. It still shows under "any price",
 * because a missing price is not a reason to hide something from family.
 */
export function inBand(item: Pick<Item, "priceCents">, band: PriceBand) {
  if (band === "any") return true;
  if (item.priceCents == null) return false;
  const range = PRICE_BANDS.find((b) => b.key === band);
  return !!range && item.priceCents >= range.min && item.priceCents < range.max;
}

/**
 * Sorting by price keeps the owner's order as the tie-break, and puts anything
 * without a price at the end either way rather than pretending it is free.
 */
export function sortItems<T extends Pick<Item, "priceCents">>(items: T[], sort: Sort): T[] {
  if (sort === "owner") return items;
  const dir = sort === "price-low" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const pa = a.item.priceCents;
      const pb = b.item.priceCents;
      if (pa == null && pb == null) return a.index - b.index;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return (pa - pb) * dir || a.index - b.index;
    })
    .map(({ item }) => item);
}

type Raw = string | string[] | undefined;
const one = (v: Raw) => (Array.isArray(v) ? v[0] : v);

/** Reads `?price=&sort=&show=` and drops anything it does not recognise. */
export function readViewParams(params: Record<string, Raw>): {
  price: PriceBand;
  sort: Sort;
  show: Show;
} {
  const price = one(params.price);
  const sort = one(params.sort);
  const show = one(params.show);
  return {
    price: price && BAND_KEYS.has(price) ? (price as PriceBand) : "any",
    sort: sort && SORT_KEYS.has(sort) ? (sort as Sort) : "owner",
    show: show && SHOW_KEYS.has(show) ? (show as Show) : "all",
  };
}
