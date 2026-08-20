import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { blurFor } from "@/lib/blur";
import { HoldTag, Ribbon } from "@/components/ui/bits";
import { Reveal } from "@/components/ui/reveal";
import { Wordmark } from "@/components/brand";
import { ClaimDemo } from "@/components/marketing/claim-demo";

export const metadata: Metadata = {
  title: "Wishwell — Know exactly what they'll love",
  description:
    "Create beautiful wishlists, share the things that matter to you, and make gifting easier for everyone.",
};

const VOICES = [
  {
    image: "sigma-lens",
    name: "Sigma 35mm f/1.4",
    person: "Hunter",
    quote:
      "Every photo I like, I have already cropped to about 35mm. Fast enough for gym light, wide enough for a table of cards without bending the corners.",
  },
  {
    image: "turntable-alt",
    name: "Rega Planar 2",
    person: "Maya",
    quote:
      "I have been playing records through a suitcase player since college and I can hear every bit of it. This is the last turntable I would ever need to buy.",
  },
  {
    image: "ryokan",
    name: "Two nights in Hakone",
    person: "Dev",
    quote:
      "The whole trip is built around one evening in an onsen town with the mountain out of the window. Everything else on this list is logistics.",
  },
];

const KINDS = [
  { image: "sony-a7", label: "A camera", meta: "$2,498 · with a video note" },
  { image: "turntable", label: "A record player", meta: "$675 · Maya's dream item" },
  { image: "sneakers", label: "Sneakers", meta: "$110 · size 10.5, plain white" },
  { image: "trading-cards", label: "A collection", meta: "$420 · the 1975 set" },
  { image: "ryokan", label: "A place to stay", meta: "$340 · not a thing at all" },
  { image: "espresso", label: "A slow save", meta: "$749 · saving, not asking" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="ground-gallery bg-bg text-fg" data-accent="madder">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-2" aria-label="Main">
          <a href="#how" className="btn btn-ghost btn-sm hidden text-muted hover:text-fg sm:inline-flex">
            How it works
          </a>
          {user ? (
            <Link href="/dashboard" className="btn btn-outline btn-sm">
              Your lists
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm text-muted hover:text-fg">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Create your wishlist
              </Link>
            </>
          )}
        </nav>
      </header>

      <main id="main">
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6">
              <Ribbon>Wishlists, minus the awkward part</Ribbon>
              <h1 className="display mt-5 text-[clamp(2.75rem,8vw,5.25rem)] balance">
                Know exactly what they&apos;ll love.
              </h1>
              <p className="voice mt-6 max-w-lg text-[clamp(1.125rem,2.4vw,1.4375rem)] leading-[1.5] text-muted pretty">
                Create beautiful wishlists, share the things that matter to you, and make gifting
                easier for everyone.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="btn btn-primary">
                  Create your wishlist
                </Link>
                <a href="#how" className="btn btn-outline">
                  Explore how it works
                </a>
              </div>
              <p className="label mt-8">
                <Link href="/hunter/graduation" className="link-underline transition-colors hover:text-fg">
                  Or look around a real one →
                </Link>
              </p>
            </div>

            <div className="lg:col-span-6">
              <ClaimDemo blurDataURL={blurFor("/media/sony-a7.jpg")} />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- voices */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="display text-[clamp(2rem,5vw,3.25rem)] balance">
                A list should sound like the person who wrote it.
              </h2>
              <p className="voice mt-5 text-[clamp(1.0625rem,2vw,1.25rem)] text-muted pretty">
                Anyone can paste a link. What makes something easy to buy is knowing why it is on
                the list at all — so every item has room for the story, in photographs, in writing,
                or in a video note thirty seconds long.
              </p>
            </div>

            <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-3">
              {VOICES.map((voice, index) => (
                <Reveal key={voice.image} delay={index * 90} variant="mask">
                  <figure>
                    <div className="relative aspect-[4/5] overflow-hidden bg-bg-sunk">
                      <Image
                        src={`/media/${voice.image}.jpg`}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        placeholder={blurFor(`/media/${voice.image}.jpg`) ? "blur" : "empty"}
                        blurDataURL={blurFor(`/media/${voice.image}.jpg`)}
                        className="object-cover"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-fg)_14%,transparent)]"
                      />
                    </div>
                    <blockquote className="voice-em mt-5 border-l border-rule-strong pl-4 text-[16.5px] leading-[1.55] pretty">
                      {voice.quote}
                    </blockquote>
                    <figcaption className="label mt-3.5">
                      {voice.person} — {voice.name}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- how it works */}
        <section id="how" className="ground-studio scroll-mt-6 bg-bg text-fg">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
            <h2 className="display text-[clamp(2rem,5vw,3.25rem)] balance">How it works</h2>
            <p className="voice mt-4 max-w-xl text-[clamp(1.0625rem,2vw,1.25rem)] text-muted pretty">
              Three steps, and only the first one takes any thought.
            </p>

            <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-10">
              {[
                {
                  n: "01",
                  title: "Add what you love",
                  body: "Paste a link or start from scratch. Add photos, a price, and a line about why you want it. That line does most of the work.",
                  aside: "Photos, multiple angles, and a video note if you feel like talking.",
                },
                {
                  n: "02",
                  title: "Share your list",
                  body: "One link, and a preview that actually looks like something. Public, link-only, or private — your call, per list.",
                  aside: "No account needed to open it, or to give something.",
                },
                {
                  n: "03",
                  title: "Let everyone coordinate",
                  body: "Whoever is buying claims the item quietly. Everyone else sees it is taken. You see none of it until the day.",
                  aside: "Holds expire on their own, so nothing sits forgotten.",
                },
              ].map((step) => (
                <li key={step.n} className="border-t-2 border-fg pt-6">
                  <span
                    className="display numeric block text-[clamp(2.5rem,6vw,3.75rem)] leading-none text-accent"
                    aria-hidden
                  >
                    {step.n}
                  </span>
                  <h3 className="display mt-5 text-[clamp(1.375rem,2.6vw,1.75rem)] balance">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15.5px] leading-[1.6] text-muted pretty">{step.body}</p>
                  <p className="voice-em mt-4 border-t border-rule pt-3 text-[14.5px] text-faint pretty">
                    {step.aside}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------- the two views - */}
        <section className="ground-studio border-t border-rule bg-bg text-fg">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <Ribbon>The part nobody else does properly</Ribbon>
              <h2 className="display mt-4 text-[clamp(2rem,5vw,3.25rem)] balance">
                Two people. Two very different views.
              </h2>
              <p className="voice mt-5 text-[clamp(1.0625rem,2vw,1.25rem)] text-muted pretty">
                A claim has to be public enough that nobody buys the same thing twice, and private
                enough that the surprise survives. So it is both — depending on who is looking.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
              <article className="border border-rule bg-surface p-5 sm:p-7">
                <h3 className="label">What everyone buying sees</h3>
                <div className="mt-5 flex items-start gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-bg-sunk">
                    <Image
                      src="/media/seiko-watch.jpg"
                      alt=""
                      fill
                      sizes="96px"
                      placeholder={blurFor("/media/seiko-watch.jpg") ? "blur" : "empty"}
                      blurDataURL={blurFor("/media/seiko-watch.jpg")}
                      className="object-cover saturate-[0.6]"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="display text-[18px]">Seiko Presage Cocktail Time</p>
                    <p className="label mt-1.5">
                      <span className="numeric text-fg">$475</span>
                      <span aria-hidden className="mx-2 opacity-40">·</span>
                      Really wants
                    </p>
                    <span className="mt-3 inline-block">
                      <HoldTag state="reserved" />
                    </span>
                  </div>
                </div>
                <p className="mt-6 border-t border-rule pt-4 text-[14.5px] text-muted pretty">
                  Someone got there first, so you pick something else. No group chat, no
                  spreadsheet, no two identical watches.
                </p>
              </article>

              <article className="border border-rule bg-surface p-5 sm:p-7">
                <h3 className="label">What Hunter sees</h3>
                <div className="mt-5 flex items-start gap-4">
                  {/* Deliberately not the real photograph, even blurred — the
                      owner's view is built without the answer in it. */}
                  <div className="veil h-24 w-24 shrink-0 overflow-hidden border border-rule">
                    <span className="block h-full w-full bg-bg-sunk" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="display text-[18px] balance">
                      <span aria-hidden className="mr-1.5">🎁</span>
                      Your Graduation list has activity
                    </p>
                    <div className="veil mt-3 space-y-2" aria-hidden>
                      <span className="block h-3 w-2/3 rounded-sm bg-bg-sunk" />
                      <span className="block h-3 w-1/3 rounded-sm bg-bg-sunk" />
                    </div>
                    <p className="mt-3 text-[14px] text-muted pretty">
                      Two items are spoken for. Which two is not his business until September.
                    </p>
                  </div>
                </div>
                <p className="mt-6 border-t border-rule pt-4 text-[14.5px] text-muted pretty">
                  Surprise mode is on by default, and it is enforced on the server — the answer is
                  never sent to his browser to be dug out later.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- item kinds */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display max-w-xl text-[clamp(2rem,5vw,3.25rem)] balance">
                Not everything worth wanting fits in a shopping cart.
              </h2>
              <p className="label max-w-xs pretty">
                A trip. A slow save. One card to finish a set.
              </p>
            </div>

            {/* Columns rather than a grid: the pictures keep their own
                proportions and the wall never ends up with a hole in it. */}
            <div className="mt-12 columns-2 gap-4 sm:gap-6 lg:columns-3">
              {KINDS.map((kind, index) => (
                <Reveal
                  key={kind.image}
                  delay={index * 60}
                  variant="mask"
                  className="mb-8 break-inside-avoid sm:mb-10"
                >
                  <figure>
                    <div
                      className="relative overflow-hidden bg-bg-sunk"
                      style={{ aspectRatio: ["4 / 5", "1 / 1", "3 / 4", "4 / 3", "1 / 1", "4 / 5"][index] }}
                    >
                      <Image
                        src={`/media/${kind.image}.jpg`}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        placeholder={blurFor(`/media/${kind.image}.jpg`) ? "blur" : "empty"}
                        blurDataURL={blurFor(`/media/${kind.image}.jpg`)}
                        className="object-cover"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-fg)_14%,transparent)]"
                      />
                    </div>
                    <figcaption className="mt-3">
                      <p className="display text-[16px]">{kind.label}</p>
                      <p className="label mt-1">{kind.meta}</p>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- final CTA */}
        <section className="relative border-t border-rule">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <h2 className="display text-[clamp(2.25rem,6vw,4rem)] balance">
                Your people want to get this right.
              </h2>
              <p className="voice mt-5 max-w-lg text-[clamp(1.0625rem,2vw,1.3125rem)] text-muted pretty">
                Give them one good link. Start with a single list — the thing you have been thinking
                about for months already counts.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/signup" className="btn btn-primary">
                  Create your first wishlist
                </Link>
                <Link href="/hunter" className="btn btn-outline">
                  See an example profile
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="relative aspect-[3/2] overflow-hidden bg-bg-sunk">
                <Image
                  src="/media/cover-graduation.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  placeholder={blurFor("/media/cover-graduation.jpg") ? "blur" : "empty"}
                  blurDataURL={blurFor("/media/cover-graduation.jpg")}
                  className="object-cover"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-fg)_14%,transparent)]"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark size="sm" />
          <nav className="label flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
            <Link href="/hunter" className="transition-colors hover:text-fg">
              Example profile
            </Link>
            <Link href="/hunter/photography" className="transition-colors hover:text-fg">
              Example list
            </Link>
            <Link href="/login" className="transition-colors hover:text-fg">
              Sign in
            </Link>
          </nav>
          <p className="label">Photographs from Unsplash</p>
        </div>
      </footer>
    </div>
  );
}
