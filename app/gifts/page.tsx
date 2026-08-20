import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { blurFor } from "@/lib/blur";
import { daysLeft, hostFromUrl, longDate, money, relativeTime } from "@/lib/format";
import { listBuyerReservations, type BuyerReservation } from "@/lib/reservations";
import { Avatar, EmptyState } from "@/components/ui/bits";
import { ExtendHold, MarkPurchased, ReleaseHold } from "@/components/app/gift-actions";

export const metadata: Metadata = { title: "Gifts you're getting" };

function urgency(reservation: BuyerReservation) {
  if (reservation.status !== "reserved" || !reservation.expiresAt) return null;
  const left = reservation.expiresAt - Date.now();
  if (left <= 0) return "expired";
  if (left <= 2 * 86_400_000) return "soon";
  return null;
}

function GiftRow({ reservation }: { reservation: BuyerReservation }) {
  const state = urgency(reservation);
  const price = money(reservation.priceCents, reservation.currency);

  return (
    <li className="border-b border-rule">
      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:gap-5">
        <Link
          href={reservation.href}
          aria-hidden
          tabIndex={-1}
          className="relative block h-24 w-full shrink-0 overflow-hidden bg-bg-sunk sm:h-20 sm:w-20"
        >
          {reservation.imageUrl ? (
            <Image
              src={reservation.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 80px"
              placeholder={blurFor(reservation.imageUrl) ? "blur" : "empty"}
              blurDataURL={blurFor(reservation.imageUrl)}
              className="object-cover"
            />
          ) : null}
        </Link>

        <div className="min-w-0 flex-1">
          <h3 className="display text-[17px] leading-tight">
            <Link href={reservation.href} className="hover:text-accent">
              {reservation.itemName}
            </Link>
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted">
            <Avatar name={reservation.ownerName} src={reservation.ownerAvatar} size={20} />
            <span>
              for <span className="text-fg">{reservation.ownerName.split(" ")[0]}</span>
            </span>
            <span aria-hidden className="opacity-40">·</span>
            <Link href={`/${reservation.ownerUsername}/${reservation.href.split("/")[2]}`} className="hover:text-fg">
              {reservation.wishlistIcon ? `${reservation.wishlistIcon} ` : ""}
              {reservation.wishlistTitle}
            </Link>
            {price ? (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span className="numeric">{price}</span>
              </>
            ) : null}
          </p>

          <p className="label mt-2">
            {reservation.status === "reserved" ? (
              <>
                Claimed {relativeTime(reservation.reservedAt)}
                {reservation.expiresAt ? (
                  <span className={state === "soon" || state === "expired" ? "text-accent" : ""}>
                    {" "}
                    · {daysLeft(reservation.expiresAt)}
                  </span>
                ) : null}
              </>
            ) : reservation.status === "purchased" ? (
              <>Bought {reservation.purchasedAt ? longDate(reservation.purchasedAt) : ""}</>
            ) : reservation.status === "released" ? (
              <>Released {reservation.releasedAt ? relativeTime(reservation.releasedAt) : ""}</>
            ) : (
              <>Hold expired</>
            )}
          </p>

          {reservation.note ? (
            <p className="voice-em mt-2 text-[14.5px] text-muted pretty">“{reservation.note}”</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {reservation.status === "reserved" ? (
            <>
              {reservation.productUrl ? (
                <a
                  href={reservation.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  {hostFromUrl(reservation.productUrl) ?? "Go to store"}
                </a>
              ) : null}
              <MarkPurchased reservationId={reservation.id} itemId={reservation.itemId} />
              {state === "soon" ? (
                <ExtendHold reservationId={reservation.id} itemId={reservation.itemId} />
              ) : null}
              <ReleaseHold reservationId={reservation.id} itemId={reservation.itemId} />
            </>
          ) : reservation.status === "purchased" ? (
            <ReleaseHold reservationId={reservation.id} itemId={reservation.itemId} />
          ) : (
            <Link href={reservation.href} className="btn btn-outline btn-sm">
              See if it is still free
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export default async function GiftsPage() {
  const viewer = await getViewer();
  const reservations = listBuyerReservations(viewer);
  const isGuest = !viewer.userId;

  const planning = reservations.filter((r) => r.status === "reserved");
  const purchased = reservations.filter((r) => r.status === "purchased");
  const past = reservations.filter((r) => r.status === "released" || r.status === "expired");
  const needsAction = planning.filter((r) => urgency(r) === "soon" || urgency(r) === "expired");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(2rem,5vw,2.75rem)]">Gifts you&apos;re getting</h1>
          <p className="voice mt-2 text-[17px] text-muted pretty">
            Everything you have claimed, in one place. None of it is visible to the people you are
            buying for.
          </p>
        </div>
      </div>

      {isGuest && reservations.length > 0 ? (
        <div className="mt-7 border border-rule bg-surface px-4 py-3.5">
          <p className="text-[14px] pretty">
            <span className="font-medium">You claimed these as a guest.</span> They are remembered on
            this browser.{" "}
            <Link href="/signup" className="link-underline">
              Make an account
            </Link>{" "}
            to keep them wherever you sign in.
          </p>
        </div>
      ) : null}

      {needsAction.length > 0 ? (
        <div className="mt-7 border-l-2 border-accent bg-accent-quiet px-4 py-3.5">
          <p className="text-[14.5px] pretty">
            <span className="font-medium">
              {needsAction.length} {needsAction.length === 1 ? "hold needs" : "holds need"} a decision.
            </span>{" "}
            Confirm the purchase or release it so someone else can pick it up.
          </p>
        </div>
      ) : null}

      {reservations.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing claimed yet"
            body="When you claim something from someone's list, it shows up here with a link back to the store and a quiet reminder if you forget."
            action={{ label: "Browse a list", href: "/hunter/graduation" }}
          />
        </div>
      ) : null}

      {planning.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 className="label">Planning to buy</h2>
            <span className="label numeric">{planning.length}</span>
          </div>
          <ul>
            {planning.map((r) => (
              <GiftRow key={r.id} reservation={r} />
            ))}
          </ul>
        </section>
      ) : null}

      {purchased.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 className="label">Bought</h2>
            <span className="label numeric">{purchased.length}</span>
          </div>
          <ul>
            {purchased.map((r) => (
              <GiftRow key={r.id} reservation={r} />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 className="label">Past</h2>
            <span className="label numeric">{past.length}</span>
          </div>
          <ul className="opacity-70">
            {past.map((r) => (
              <GiftRow key={r.id} reservation={r} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
