import { loadItemPage } from "@/lib/item-page";
import { ItemDetail } from "@/components/wishlist/item-detail";
import { ItemModal } from "@/components/wishlist/item-modal";
import { ListProvider } from "@/components/wishlist/list-context";

export default async function InterceptedItem({
  params,
}: {
  params: Promise<{ username: string; slug: string; itemId: string }>;
}) {
  const { username, slug, itemId } = await params;
  const data = await loadItemPage(username, slug, itemId);
  if (!data) return null;

  const { item, list, profile, ownerSettings, signedIn } = data;
  const firstName = profile.displayName.split(" ")[0];

  return (
    <ListProvider
      value={{
        signedIn,
        allowGuests: ownerSettings.allowGuestReservations,
        ownerName: profile.displayName,
        ownerFirstName: firstName,
        reservationDays: ownerSettings.reservationsExpire ? ownerSettings.reservationDays : null,
        listTitle: list.title,
        listHref: `/${username}/${slug}`,
        ground: "gallery",
      }}
    >
      <div data-accent={list.accent}>
        <ItemModal title={item.name} listTitle={list.title}>
          <ItemDetail item={item} ownerFirstName={firstName} compact />
        </ItemModal>
      </div>
    </ListProvider>
  );
}
