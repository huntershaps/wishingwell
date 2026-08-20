import "server-only";
import { getCurrentUser, getGuestToken, getSettings } from "./auth";
import { checkAccess, getItems, getPublicProfile, getWishlistBySlug } from "./queries";
import type { Item, Profile, Settings, Wishlist } from "./types";

export type ItemPageData = {
  item: Item;
  list: Wishlist;
  profile: Profile;
  ownerSettings: Settings;
  isOwner: boolean;
  signedIn: boolean;
};

/**
 * Loads one item through exactly the same access and surprise-mode rules as the
 * list it belongs to, so a direct link to an item can never reveal more than
 * the wall it hangs on.
 */
export async function loadItemPage(
  username: string,
  slug: string,
  itemId: string,
): Promise<ItemPageData | null> {
  const profile = getPublicProfile(username);
  if (!profile) return null;
  const list = getWishlistBySlug(username, slug);
  if (!list) return null;

  const user = await getCurrentUser();
  const viewer = { userId: user?.id ?? null, guestToken: await getGuestToken() };
  const access = await checkAccess(list, viewer);
  if (!access.allowed) return null;

  const ownerSettings = getSettings(list.userId);
  const item = getItems(list.id, {
    viewer,
    isOwner: access.isOwner,
    surpriseMode: ownerSettings.surpriseMode,
  }).find((i) => i.id === itemId);
  if (!item) return null;

  return { item, list, profile, ownerSettings, isOwner: access.isOwner, signedIn: !!user };
}
