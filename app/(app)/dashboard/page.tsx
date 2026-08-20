import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { blurFor } from "@/lib/blur";
import { countdownToEvent, greeting, longDate, relativeTime } from "@/lib/format";
import { getListStats, getOwnerOverview, getOwnerWishlists, nextEvent } from "@/lib/queries";
import { EmptyState } from "@/components/ui/bits";
import { ShareButton } from "@/components/wishlist/share";

export const metadata: Metadata = { title: "Your lists" };

const VISIBILITY_LABEL = {
  public: "Public",
  link: "Link only",
  private: "Private",
} as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const lists = getOwnerWishlists(user.id).filter((l) => !l.archivedAt);
  const overview = getOwnerOverview(user.id);
  const username = user.profile.username;

  const upcoming = nextEvent(lists);
  const rest = lists.filter((l) => l.id !== upcoming?.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(2rem,5vw,2.75rem)]">
            {greeting()}, {user.profile.displayName.split(" ")[0]}
          </h1>
          <p className="voice mt-2 text-[17px] text-muted">
            {upcoming
              ? `${countdownToEvent(upcoming.eventDate)?.toLowerCase() === "today" ? "Today is" : countdownToEvent(upcoming.eventDate)} — ${upcoming.title}.`
              : lists.length
                ? `${overview.items} things across ${overview.lists} ${overview.lists === 1 ? "list" : "lists"}.`
                : "Let's put something on a list."}
          </p>
        </div>
        <Link href="/dashboard/new" className="btn btn-primary">
          New list
        </Link>
      </div>

      {/* Deliberately coarse. Enough to know something is happening, never
          enough to work out what. */}
      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-rule py-5 sm:grid-cols-4">
        <div>
          <dt className="label">Lists</dt>
          <dd className="display numeric mt-1 text-[24px]">{overview.lists}</dd>
        </div>
        <div>
          <dt className="label">Items</dt>
          <dd className="display numeric mt-1 text-[24px]">{overview.items}</dd>
        </div>
        <div>
          <dt className="label">Views</dt>
          <dd className="display numeric mt-1 text-[24px]">{overview.views}</dd>
        </div>
        <div>
          <dt className="label">Gift activity</dt>
          <dd className="display numeric mt-1 flex items-baseline gap-2 text-[24px]">
            {user.settings.surpriseMode ? (
              <>
                <span aria-hidden>🎁</span>
                <span className="text-[15px] font-normal tracking-normal text-muted">
                  {overview.activity > 0 ? "Something is happening" : "Nothing yet"}
                </span>
              </>
            ) : (
              overview.activity
            )}
          </dd>
        </div>
      </dl>

      {user.settings.surpriseMode && overview.activity > 0 ? (
        <p className="mt-3 text-[13px] text-faint pretty">
          Surprise mode is on, so we keep the details to ourselves.{" "}
          <Link href="/settings" className="link-underline">
            Change that in settings
          </Link>
          .
        </p>
      ) : null}

      {lists.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No lists yet"
            body="A list can be one thing you have been thinking about for months. Start there."
            action={{ label: "Make your first list", href: "/dashboard/new" }}
          />
        </div>
      ) : null}

      {upcoming ? (
        <section className="mt-10">
          <h2 className="label">Coming up</h2>
          <article className="mt-4 grid gap-6 border border-rule bg-surface p-4 sm:grid-cols-12 sm:items-center sm:gap-8 sm:p-6">
            <Link
              href={`/dashboard/lists/${upcoming.id}`}
              aria-hidden
              tabIndex={-1}
              className="relative block aspect-[16/10] overflow-hidden bg-bg-sunk sm:col-span-5"
            >
              {upcoming.coverUrl ? (
                <Image
                  src={upcoming.coverUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 40vw"
                  placeholder={blurFor(upcoming.coverUrl) ? "blur" : "empty"}
                  blurDataURL={blurFor(upcoming.coverUrl)}
                  className="object-cover"
                />
              ) : null}
            </Link>
            <div className="sm:col-span-7">
              <p className="label text-accent">{countdownToEvent(upcoming.eventDate)}</p>
              <h3 className="display mt-2 text-[clamp(1.5rem,3vw,2rem)]">
                {upcoming.icon ? <span className="mr-2">{upcoming.icon}</span> : null}
                <Link href={`/dashboard/lists/${upcoming.id}`} className="hover:text-accent">
                  {upcoming.title}
                </Link>
              </h3>
              <p className="voice mt-2 text-[16px] text-muted pretty">
                {longDate(upcoming.eventDate)} · {upcoming.itemCount} items ·{" "}
                {VISIBILITY_LABEL[upcoming.visibility]}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/dashboard/lists/${upcoming.id}`} className="btn btn-solid btn-sm">
                  Add an item
                </Link>
                <ShareButton
                  path={
                    upcoming.visibility === "link"
                      ? `/w/${upcoming.shareToken}`
                      : `/${username}/${upcoming.slug}`
                  }
                  title={upcoming.title}
                  description={upcoming.description}
                  coverUrl={upcoming.coverUrl}
                  icon={upcoming.icon}
                  ownerName={user.profile.displayName}
                  ground="studio"
                />
                <Link href={`/${username}/${upcoming.slug}`} className="btn btn-outline btn-sm">
                  View as visitor
                </Link>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="label">Your lists</h2>
            <Link href={`/${username}`} className="label transition-colors hover:text-fg">
              See your public profile
            </Link>
          </div>

          <ul className="mt-4 border-t border-rule">
            {rest.map((list) => {
              const stats = getListStats(list.id);
              return (
                <li key={list.id} className="border-b border-rule">
                  <div className="flex items-center gap-4 py-4 sm:gap-6">
                    <Link
                      href={`/dashboard/lists/${list.id}`}
                      aria-hidden
                      tabIndex={-1}
                      className="relative block h-16 w-24 shrink-0 overflow-hidden bg-bg-sunk sm:h-20 sm:w-32"
                    >
                      {list.coverUrl ? (
                        <Image
                          src={list.coverUrl}
                          alt=""
                          fill
                          sizes="128px"
                          placeholder={blurFor(list.coverUrl) ? "blur" : "empty"}
                          blurDataURL={blurFor(list.coverUrl)}
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[20px]">
                          {list.icon ?? "✳︎"}
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <h3 className="display text-[18px] leading-tight">
                        <Link href={`/dashboard/lists/${list.id}`} className="hover:text-accent">
                          {list.icon ? <span className="mr-1.5">{list.icon}</span> : null}
                          {list.title}
                        </Link>
                      </h3>
                      <p className="label mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{list.itemCount} items</span>
                        <span aria-hidden className="opacity-40">·</span>
                        <span>{VISIBILITY_LABEL[list.visibility]}</span>
                        <span aria-hidden className="opacity-40">·</span>
                        <span>{stats.views} views</span>
                        {stats.giftActivityCount > 0 ? (
                          <>
                            <span aria-hidden className="opacity-40">·</span>
                            <span className="text-accent">
                              {user.settings.surpriseMode
                                ? "🎁 activity"
                                : `${stats.giftActivityCount} claimed`}
                            </span>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 hidden text-[13px] text-faint sm:block">
                        Updated {relativeTime(list.updatedAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden sm:inline">
                        <ShareButton
                          path={
                            list.visibility === "link"
                              ? `/w/${list.shareToken}`
                              : `/${username}/${list.slug}`
                          }
                          title={list.title}
                          description={list.description}
                          coverUrl={list.coverUrl}
                          icon={list.icon}
                          ownerName={user.profile.displayName}
                          ground="studio"
                        />
                      </span>
                      <Link href={`/dashboard/lists/${list.id}`} className="btn btn-outline btn-sm">
                        Edit
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
