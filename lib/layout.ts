import type { Item } from "./types";

export type Variant = "feature" | "tall" | "standard" | "quiet";

/**
 * Decides how much room each item gets on the wall.
 *
 * The scale is derived from the item itself — what the owner pinned, how badly
 * they want it, whether they filmed a note, how much they gave us to look at —
 * so the page composes differently for every list instead of repeating one grid.
 */
export function planLayout(items: Item[]): { item: Item; variant: Variant }[] {
  let features = 0;
  let sinceFeature = 99;

  return items.map((item, index) => {
    const hasVideo = item.media.some((m) => m.kind === "video");
    const wantsFeature = item.feature || item.priority === "dream" || (index === 0 && !!item.whyWant);
    const roomForFeature = features < 2 && sinceFeature >= 3 && item.media.length > 0;

    let variant: Variant;
    if (wantsFeature && roomForFeature) {
      variant = "feature";
      features += 1;
      sinceFeature = 0;
    } else if (hasVideo || (item.priority === "high" && item.media.length > 1)) {
      variant = "tall";
    } else if (item.priority === "someday" || item.media.length === 0) {
      variant = "quiet";
    } else {
      variant = "standard";
    }

    if (variant !== "feature") sinceFeature += 1;
    return { item, variant };
  });
}

export const SPAN: Record<Variant, string> = {
  feature: "col-span-1 sm:col-span-4 lg:col-span-6",
  tall: "col-span-1 sm:col-span-2 lg:col-span-3",
  standard: "col-span-1 sm:col-span-2 lg:col-span-2",
  quiet: "col-span-1 sm:col-span-2 lg:col-span-2",
};

export const RATIO: Record<Variant, string> = {
  feature: "3 / 2",
  tall: "4 / 5",
  standard: "1 / 1",
  quiet: "3 / 2",
};
