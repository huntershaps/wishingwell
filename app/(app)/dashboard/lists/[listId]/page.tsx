import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { blurFor } from "@/lib/blur";
import { deleteItemAction, deleteListAction } from "@/lib/actions/lists";
import { longDate, money, PRIORITY } from "@/lib/format";
import { getItems, getListStats, getWishlistById } from "@/lib/queries";
import { ConfirmButton } from "@/components/app/confirm-button";
import { ItemComposer } from "@/components/app/item-composer";
import { ListForm } from "@/components/app/list-form";
import { ShareButton } from "@/components/wishlist/share";

export const metadata: Metadata = { title: "Edit list" };

export default async function ListEditorPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const user = await requireUser();
  const list = await getWishlistById(listId);
  if (!list || list.userId !== user.id) notFound();

  const items = await getItems(list.id, {
    viewer: { userId: user.id, guestToken: null },
    isOwner: true,
    surpriseMode: user.settings.surpriseMode,
  });
  const stats = await getListStats(list.id);
  const username = user.profile.username;
  const publicPath = `/${username}/${list.slug}`;

  return (
    <div data-accent={list.accent}>
      <nav className="label mb-6">
        <Link href="/dashboard" className="transition-colors hover:text-fg">
          ← Your lists
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-[clamp(1.875rem,5vw,2.5rem)]">
            {list.icon ? <span className="mr-2">{list.icon}</span> : null}
            {list.title}
          </h1>
          <p className="label mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{items.length} items</span>
            <span aria-hidden className="opacity-40">·</span>
            <span>{stats.views} views</span>
            <span aria-hidden className="opacity-40">·</span>
            <span>{stats.shares} shares</span>
            {list.eventDate ? (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span>{longDate(list.eventDate)}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton
            path={list.visibility === "link" ? `/w/${list.shareToken}` : publicPath}
            title={list.title}
            description={list.description}
            coverUrl={list.coverUrl}
            icon={list.icon}
            ownerName={user.profile.displayName}
            ground="studio"
          />
          <Link href={publicPath} className="btn btn-outline btn-sm">
            View as visitor
          </Link>
          <ItemComposer listId={list.id} listTitle={list.title} trigger={{ label: "Add item" }} />
        </div>
      </div>

      {/* The privacy promise, made visible: the owner is shown the shape of the
          secret and nothing else. */}
      {stats.giftActivityCount > 0 && user.settings.surpriseMode ? (
        <section className="mt-8 border border-rule bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-medium">
                <span aria-hidden className="mr-1.5">🎁</span>
                {stats.giftActivityCount} {stats.giftActivityCount === 1 ? "item is" : "items are"}{" "}
                spoken for
              </h2>
              <p className="mt-1 text-[13.5px] text-muted pretty">
                Which ones stays between the people buying them. You will find out the usual way.
              </p>
            </div>
            <Link href="/settings" className="label transition-colors hover:text-fg">
              Surprise mode: on
            </Link>
          </div>
          <div className="veil mt-4 flex gap-2" aria-hidden>
            {Array.from({ length: Math.min(stats.giftActivityCount, 4) }).map((_, i) => (
              <span key={i} className="h-7 flex-1 rounded-sm bg-bg-sunk" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="label">Items</h2>

        {items.length === 0 ? (
          <div className="mt-4 border border-dashed border-rule-strong px-6 py-14 text-center">
            <h3 className="display text-[20px]">Nothing here yet</h3>
            <p className="voice mx-auto mt-2 max-w-sm text-[15.5px] text-muted pretty">
              Add the first thing. A photo and a sentence about why you want it is plenty.
            </p>
            <div className="mt-5">
              <ItemComposer
                listId={list.id}
                listTitle={list.title}
                trigger={{ label: "Add the first item", className: "btn btn-primary btn-sm" }}
              />
            </div>
          </div>
        ) : (
          <ul className="mt-4 border-t border-rule">
            {items.map((item) => {
              const image = item.media.find((m) => m.kind === "image");
              const hasVideo = item.media.some((m) => m.kind === "video");
              return (
                <li key={item.id} className="border-b border-rule">
                  <div className="flex items-center gap-4 py-3.5">
                    <span className="relative block h-16 w-16 shrink-0 overflow-hidden bg-bg-sunk">
                      {image ? (
                        <Image
                          src={image.url}
                          alt=""
                          fill
                          sizes="64px"
                          placeholder={blurFor(image.url) ? "blur" : "empty"}
                          blurDataURL={blurFor(image.url)}
                          className="object-cover"
                        />
                      ) : null}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15.5px] font-medium leading-tight">{item.name}</h3>
                      <p className="label mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {item.priceCents != null ? (
                          <span className="numeric">{money(item.priceCents, item.currency)}</span>
                        ) : (
                          <span>No price</span>
                        )}
                        <span aria-hidden className="opacity-40">·</span>
                        <span>{PRIORITY[item.priority].short}</span>
                        <span aria-hidden className="opacity-40">·</span>
                        <span>
                          {item.media.length} {item.media.length === 1 ? "photo" : "media"}
                          {hasVideo ? " incl. video" : ""}
                        </span>
                        {!user.settings.surpriseMode && item.giftState !== "available" ? (
                          <>
                            <span aria-hidden className="opacity-40">·</span>
                            <span className="text-accent">
                              {item.giftState === "purchased" ? "Bought" : "Claimed"}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <ItemComposer
                        listId={list.id}
                        listTitle={list.title}
                        item={item}
                        trigger={{ label: "Edit", className: "btn btn-ghost btn-sm text-muted hover:text-fg" }}
                      />
                      <ConfirmButton action={deleteItemAction} hidden={{ itemId: item.id }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-14 max-w-3xl">
        <h2 className="label">List settings</h2>
        <div className="mt-5">
          <ListForm list={list} username={username} />
        </div>
      </section>

      <section className="mt-14 max-w-3xl border-t border-rule pt-6">
        <h2 className="label">Delete this list</h2>
        <p className="mt-2 max-w-lg text-[14px] text-muted pretty">
          Removes the list, its items, and any claims people have made on it. This cannot be undone.
        </p>
        <div className="mt-3">
          <ConfirmButton
            action={deleteListAction}
            hidden={{ listId: list.id }}
            label="Delete list"
            confirmLabel="Press again to delete permanently"
            className="btn btn-outline btn-sm"
          />
        </div>
      </section>
    </div>
  );
}
