import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadItemPage } from "@/lib/item-page";
import { money } from "@/lib/format";
import { Wordmark } from "@/components/brand";
import { ItemDetail } from "@/components/wishlist/item-detail";
import { ListProvider } from "@/components/wishlist/list-context";
import { ShareButton } from "@/components/wishlist/share";

type Params = { params: Promise<{ username: string; slug: string; itemId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, slug, itemId } = await params;
  const data = await loadItemPage(username, slug, itemId);
  if (!data) return { title: "Item not found" };
  const price = money(data.item.priceCents, data.item.currency);
  return {
    title: `${data.item.name} — ${data.list.title}`,
    description:
      data.item.whyWant?.slice(0, 180) ??
      data.item.description ??
      `On ${data.profile.displayName}'s ${data.list.title} list${price ? ` · ${price}` : ""}`,
    openGraph: {
      images: data.item.media.find((m) => m.kind === "image")?.url
        ? [{ url: data.item.media.find((m) => m.kind === "image")!.url }]
        : undefined,
    },
  };
}

export default async function ItemPage({ params }: Params) {
  const { username, slug, itemId } = await params;
  const data = await loadItemPage(username, slug, itemId);
  if (!data) notFound();

  const { item, list, profile, ownerSettings, signedIn } = data;
  const firstName = profile.displayName.split(" ")[0];
  const listHref = `/${username}/${slug}`;

  return (
    <ListProvider
      value={{
        signedIn,
        allowGuests: ownerSettings.allowGuestReservations,
        ownerName: profile.displayName,
        ownerFirstName: firstName,
        reservationDays: ownerSettings.reservationsExpire ? ownerSettings.reservationDays : null,
        listTitle: list.title,
        listHref,
        ground: "gallery",
      }}
    >
      <div data-accent={list.accent}>
        <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Wordmark size="sm" />
          <ShareButton
            path={`${listHref}/i/${item.id}`}
            title={item.name}
            description={item.whyWant ?? item.description}
            coverUrl={item.media.find((m) => m.kind === "image")?.url ?? list.coverUrl}
            ownerName={profile.displayName}
            variant="ghost"
          />
        </header>

        <main id="main" className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
          <nav aria-label="Breadcrumb" className="label mb-6 flex flex-wrap items-center gap-2">
            <Link href={`/${username}`} className="transition-colors hover:text-fg">
              {profile.displayName}
            </Link>
            <span aria-hidden className="opacity-40">/</span>
            <Link href={listHref} className="transition-colors hover:text-fg">
              {list.title}
            </Link>
          </nav>

          <ItemDetail item={item} ownerFirstName={firstName} />

          <div className="mt-16 border-t border-rule pt-6">
            <Link href={listHref} className="btn btn-outline btn-sm">
              ← Back to {list.title}
            </Link>
          </div>
        </main>
      </div>
    </ListProvider>
  );
}
