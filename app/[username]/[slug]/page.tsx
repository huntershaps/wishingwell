import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuestToken, getCurrentUser, getSettings } from "@/lib/auth";
import { blurFor } from "@/lib/blur";
import { countdownToEvent, longDate, monthYear } from "@/lib/format";
import { planLayout, SPAN } from "@/lib/layout";
import {
  checkAccess,
  getItems,
  getPublicProfile,
  getWishlistBySlug,
  recordEvent,
} from "@/lib/queries";
import { Avatar, Ribbon } from "@/components/ui/bits";
import { Reveal } from "@/components/ui/reveal";
import { Wordmark } from "@/components/brand";
import { GalleryFilter } from "@/components/wishlist/gallery-filter";
import { ItemCard } from "@/components/wishlist/item-card";
import { ListProvider } from "@/components/wishlist/list-context";
import { ShareButton } from "@/components/wishlist/share";

type Params = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, slug } = await params;
  const list = getWishlistBySlug(username, slug);
  const profile = getPublicProfile(username);
  if (!list || !profile) return { title: "List not found" };
  const title = `${list.title} · ${profile.displayName}`;
  return {
    title,
    description: list.description ?? `${profile.displayName}'s wishlist on Wishwell`,
    openGraph: {
      title,
      description: list.description ?? undefined,
      images: list.coverUrl ? [{ url: list.coverUrl }] : undefined,
      type: "website",
    },
    robots: list.visibility === "public" ? undefined : { index: false, follow: false },
  };
}

function Locked({
  reason,
  ownerName,
  username,
}: {
  reason: "private" | "link_required";
  ownerName: string;
  username: string;
}) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-20">
      <Wordmark />
      <h1 className="display mt-10 text-[clamp(2rem,6vw,2.75rem)] balance">
        {reason === "private" ? "This list is kept private." : "This list is shared by link only."}
      </h1>
      <p className="voice mt-4 text-[17px] text-muted pretty">
        {reason === "private"
          ? `${ownerName} keeps this one to themselves. Nothing to see here, which is exactly how they wanted it.`
          : `${ownerName} shares this list with a direct link. Ask them to send it over and it will open right up.`}
      </p>
      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link href={`/${username}`} className="btn btn-outline">
          See {ownerName.split(" ")[0]}&apos;s public lists
        </Link>
        <Link href="/" className="btn btn-ghost">
          What is Wishwell?
        </Link>
      </div>
    </main>
  );
}

export default async function WishlistPage({ params }: Params) {
  const { username, slug } = await params;
  const profile = getPublicProfile(username);
  const list = profile ? getWishlistBySlug(username, slug) : null;
  if (!profile || !list) notFound();

  const user = await getCurrentUser();
  const viewer = { userId: user?.id ?? null, guestToken: await getGuestToken() };
  const access = await checkAccess(list, viewer);

  if (!access.allowed) {
    return <Locked reason={access.reason} ownerName={profile.displayName} username={username} />;
  }

  const ownerSettings = getSettings(list.userId);
  const items = getItems(list.id, {
    viewer,
    isOwner: access.isOwner,
    surpriseMode: ownerSettings.surpriseMode,
  });

  if (!access.isOwner) recordEvent(list.id, "view");

  const plan = planLayout(items);
  const claimedCount = items.filter(
    (i) => i.giftState === "reserved" || i.giftState === "purchased",
  ).length;
  const availableCount = items.length - claimedCount;
  const firstName = profile.displayName.split(" ")[0];
  const countdown = countdownToEvent(list.eventDate);
  const listHref = `/${username}/${slug}`;

  return (
    <ListProvider
      value={{
        signedIn: !!user,
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
        <header className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Wordmark size="sm" />
          <div className="flex items-center gap-2">
            <ShareButton
              path={list.visibility === "link" ? `/w/${list.shareToken}` : listHref}
              title={list.title}
              description={list.description}
              coverUrl={list.coverUrl}
              icon={list.icon}
              ownerName={profile.displayName}
              variant="ghost"
            />
            {user ? (
              <Link href="/dashboard" className="btn btn-outline btn-sm">
                Your lists
              </Link>
            ) : (
              <Link href="/signup" className="btn btn-outline btn-sm">
                Make your own
              </Link>
            )}
          </div>
        </header>

        {access.isOwner ? (
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-rule bg-[color-mix(in_oklab,var(--color-fg)_5%,transparent)] px-4 py-3">
              <p className="text-[13.5px] text-muted pretty">
                <span className="text-fg">This is your list, seen the way visitors see it.</span>{" "}
                {ownerSettings.surpriseMode
                  ? "Anything already claimed stays hidden from you."
                  : "Surprise mode is off, so claimed items are marked."}
              </p>
              <Link href={`/dashboard/lists/${list.id}`} className="btn btn-outline btn-sm">
                Edit list
              </Link>
            </div>
          </div>
        ) : null}

        {/* The work first, then the wall label. */}
        <section className="relative mt-4 sm:mt-6">
          <div className="relative mx-auto max-w-[1400px] sm:px-8">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-bg-sunk sm:aspect-[21/9]">
              {list.coverUrl ? (
                <Image
                  src={list.coverUrl}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  placeholder={blurFor(list.coverUrl) ? "blur" : "empty"}
                  blurDataURL={blurFor(list.coverUrl)}
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,color-mix(in_oklab,var(--color-accent)_28%,transparent),transparent)]" />
              )}
              {/* Two scrims: one ties the photograph into the ground, one buys
                  the title enough contrast whatever the picture is doing. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[color-mix(in_oklab,var(--color-bg)_28%,transparent)] to-transparent"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[rgba(8,5,7,0.62)] to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                {list.occasion || countdown ? (
                  <Ribbon>
                    {[list.occasion, countdown].filter(Boolean).join(" · ")}
                  </Ribbon>
                ) : null}
                <h1 className="display mt-3 text-[clamp(2.5rem,7.5vw,5.5rem)] balance">
                  {list.icon ? (
                    <span aria-hidden className="mr-3 align-middle text-[0.72em]">
                      {list.icon}
                    </span>
                  ) : null}
                  {list.title}
                </h1>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 pt-7 sm:px-8 sm:pt-9">
          <div className="grid gap-8 border-b border-rule pb-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              {list.description ? (
                <p className="voice text-[clamp(1.0625rem,2vw,1.375rem)] leading-[1.55] text-fg pretty">
                  {list.description}
                </p>
              ) : null}
              <Link
                href={`/${username}`}
                className="mt-6 inline-flex items-center gap-3 rounded-sm transition-opacity hover:opacity-80"
              >
                <Avatar name={profile.displayName} src={profile.avatarUrl} size={42} />
                <span>
                  <span className="block text-[15px] font-medium">{profile.displayName}</span>
                  <span className="label block">@{profile.username}</span>
                </span>
              </Link>
            </div>

            {/* One line on a phone, a proper wall label from tablet up. */}
            <p className="label flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
              <span className="numeric text-fg">{items.length} items</span>
              <span aria-hidden className="opacity-40">·</span>
              <span className="numeric">{availableCount} still available</span>
              {list.eventDate ? (
                <>
                  <span aria-hidden className="opacity-40">·</span>
                  <span>{longDate(list.eventDate)}</span>
                </>
              ) : null}
            </p>
            <div className="sm:hidden">
              <ShareButton
                path={list.visibility === "link" ? `/w/${list.shareToken}` : listHref}
                title={list.title}
                description={list.description}
                coverUrl={list.coverUrl}
                icon={list.icon}
                ownerName={profile.displayName}
                label="Share this list"
              />
            </div>

            <dl className="hidden grid-cols-2 gap-x-6 gap-y-5 self-start sm:grid lg:col-span-5 lg:grid-cols-2">
              <div>
                <dt className="label">Items</dt>
                <dd className="display numeric mt-1 text-[22px]">{items.length}</dd>
              </div>
              <div>
                <dt className="label">Still available</dt>
                <dd className="display numeric mt-1 text-[22px]">{availableCount}</dd>
              </div>
              {list.eventDate ? (
                <div>
                  <dt className="label">Date</dt>
                  <dd className="mt-1 text-[15px]">{longDate(list.eventDate)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="label">Started</dt>
                <dd className="mt-1 text-[15px]">{monthYear(list.createdAt)}</dd>
              </div>
            </dl>

            <div className="hidden self-start sm:block lg:col-span-5">
              <ShareButton
                path={list.visibility === "link" ? `/w/${list.shareToken}` : listHref}
                title={list.title}
                description={list.description}
                coverUrl={list.coverUrl}
                icon={list.icon}
                ownerName={profile.displayName}
                label="Share this list"
              />
            </div>
          </div>
        </section>

        <main id="main" className="mx-auto max-w-[1400px] px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
          {items.length === 0 ? (
            <div className="border border-dashed border-rule-strong px-6 py-20 text-center">
              <h2 className="display text-[22px]">Nothing on this list yet</h2>
              <p className="voice mt-2 text-[16px] text-muted">
                {firstName} hasn&apos;t added anything here. Check back soon.
              </p>
            </div>
          ) : (
            <>
              {!access.isOwner ? (
                <p className="mb-6 max-w-2xl text-[13.5px] text-faint pretty">
                  Claim anything here and it will be marked as spoken for. {firstName} sees only that
                  the list has activity, never what and never who.
                </p>
              ) : null}

              <GalleryFilter
                counts={{ all: items.length, available: availableCount, claimed: claimedCount }}
                hideClaimed={access.isOwner && ownerSettings.surpriseMode}
              >
                <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-4 sm:gap-y-14 lg:grid-cols-6">
                  {plan.map(({ item, variant }, index) => (
                    <Reveal
                      key={item.id}
                      className={SPAN[variant]}
                      delay={Math.min(index, 4) * 55}
                      variant={variant === "feature" ? "rise" : "mask"}
                    >
                      <div
                        data-item-state={
                          item.giftState === "available" || item.giftState === "hidden"
                            ? "available"
                            : "claimed"
                        }
                      >
                        <ItemCard
                          item={item}
                          variant={variant}
                          href={`/${username}/${slug}/i/${item.id}`}
                          index={index}
                        />
                      </div>
                    </Reveal>
                  ))}
                </div>
              </GalleryFilter>
            </>
          )}
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="voice text-[16px] text-muted">
              {firstName} made this list on Wishwell.
            </p>
            <Link href="/signup" className="btn btn-primary btn-sm self-start">
              Start your own list
            </Link>
          </div>
        </footer>
      </div>
    </ListProvider>
  );
}
