import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { blurFor } from "@/lib/blur";
import { countdownToEvent, longDate, monthYear } from "@/lib/format";
import { getPublicProfile, getVisibleWishlists } from "@/lib/queries";
import { Avatar } from "@/components/ui/bits";
import { Reveal } from "@/components/ui/reveal";
import { Wordmark } from "@/components/brand";
import { ShareButton } from "@/components/wishlist/share";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile not found" };
  return {
    title: profile.displayName,
    description: profile.bio ?? `${profile.displayName} on Wishwell`,
    robots: profile.discoverable ? undefined : { index: false, follow: false },
  };
}

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const user = await getCurrentUser();
  const isOwner = user?.id === profile.userId;

  if (profile.visibility === "private" && !isOwner) {
    return (
      <div className="ground-gallery min-h-dvh bg-bg text-fg">
        <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
          <Wordmark />
          <h1 className="display mt-10 text-[clamp(2rem,6vw,2.75rem)] balance">
            This profile is private.
          </h1>
          <p className="voice mt-4 text-[17px] text-muted pretty">
            {profile.displayName} keeps their profile to themselves. A list they shared with you
            directly will still open.
          </p>
          <Link href="/" className="btn btn-outline mt-8 self-start">
            What is Wishwell?
          </Link>
        </main>
      </div>
    );
  }

  const lists = await getVisibleWishlists(profile.userId, {
    userId: user?.id ?? null,
    guestToken: null,
  });
  const firstName = profile.displayName.split(" ")[0];

  return (
    <div className="ground-gallery min-h-dvh bg-bg text-fg" data-accent={profile.accent}>
      <header className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Wordmark size="sm" />
        <div className="flex items-center gap-2">
          <ShareButton
            path={`/${profile.username}`}
            title={profile.displayName}
            description={profile.bio}
            ownerName={profile.displayName}
            variant="ghost"
            label="Share profile"
          />
          {isOwner ? (
            <Link href="/dashboard" className="btn btn-outline btn-sm">
              Your lists
            </Link>
          ) : user ? null : (
            <Link href="/signup" className="btn btn-outline btn-sm">
              Make your own
            </Link>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1100px] px-5 pb-24 sm:px-8">
        <section className="border-b border-rule py-10 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <Avatar name={profile.displayName} src={profile.avatarUrl} size={84} className="text-[26px]" />
            <div className="min-w-0 flex-1">
              <h1 className="display text-[clamp(2.25rem,7vw,4rem)] balance">
                {profile.displayName}
              </h1>
              <p className="label mt-2">@{profile.username}</p>
              {profile.bio ? (
                <p className="voice mt-5 max-w-2xl text-[clamp(1.0625rem,2.2vw,1.375rem)] leading-[1.5] pretty">
                  {profile.bio}
                </p>
              ) : null}
              <div className="label mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span>
                  {lists.length} {lists.length === 1 ? "list" : "lists"}
                </span>
                {profile.location ? <span>{profile.location}</span> : null}
                {profile.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="link-underline text-accent"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {lists.length === 0 ? (
          <div className="border border-dashed border-rule-strong px-6 py-20 text-center">
            <h2 className="display text-[22px]">No public lists yet</h2>
            <p className="voice mt-2 text-[16px] text-muted">
              {isOwner
                ? "Set a list to public and it will show up here."
                : `${firstName} keeps their lists private or shares them by link.`}
            </p>
          </div>
        ) : (
          <section className="pt-10 sm:pt-14">
            <h2 className="label">{isOwner ? "Your lists" : "Lists"}</h2>
            <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((list, index) => (
                <Reveal key={list.id} delay={Math.min(index, 5) * 60} variant="mask">
                  <article className="group">
                    <Link
                      href={`/${profile.username}/${list.slug}`}
                      aria-hidden
                      tabIndex={-1}
                      className="relative block aspect-[4/3] overflow-hidden bg-bg-sunk"
                    >
                      {list.coverUrl ? (
                        <Image
                          src={list.coverUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          placeholder={blurFor(list.coverUrl) ? "blur" : "empty"}
                          blurDataURL={blurFor(list.coverUrl)}
                          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[40px]">
                          {list.icon ?? "✳︎"}
                        </span>
                      )}
                      <span
                        aria-hidden
                        className="absolute inset-0 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-fg)_14%,transparent)]"
                      />
                      {isOwner && list.visibility !== "public" ? (
                        <span className="absolute right-3 top-3 rounded-full bg-[rgba(12,8,10,0.66)] px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">
                          {list.visibility === "link" ? "Link only" : "Private"}
                        </span>
                      ) : null}
                    </Link>
                    <h3 className="display mt-3.5 text-[19px]">
                      <Link
                        href={`/${profile.username}/${list.slug}`}
                        className="transition-colors hover:text-accent"
                      >
                        {list.icon ? <span className="mr-1.5">{list.icon}</span> : null}
                        {list.title}
                      </Link>
                    </h3>
                    <p className="label mt-1.5 flex flex-wrap items-center gap-x-2">
                      <span>{list.itemCount} items</span>
                      <span aria-hidden className="opacity-40">·</span>
                      <span>
                        {list.eventDate
                          ? (countdownToEvent(list.eventDate) ?? longDate(list.eventDate))
                          : `Since ${monthYear(list.createdAt)}`}
                      </span>
                    </p>
                    {list.description ? (
                      <p className="voice-em mt-2 line-clamp-2 text-[14.5px] text-muted pretty">
                        {list.description}
                      </p>
                    ) : null}
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="voice text-[16px] text-muted">
            {isOwner ? "This is your public page." : `${firstName} is on Wishwell.`}
          </p>
          <Link href="/signup" className="btn btn-primary btn-sm self-start">
            Start your own list
          </Link>
        </div>
      </footer>
    </div>
  );
}
