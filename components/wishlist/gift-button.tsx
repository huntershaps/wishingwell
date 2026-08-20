"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { reserveAction, type GiftState } from "@/lib/actions/gifts";
import { hostFromUrl, money } from "@/lib/format";
import type { Item } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { HoldTag } from "@/components/ui/bits";
import { useToast } from "@/components/ui/toast";
import { useList } from "./list-context";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending} data-autofocus>
      {pending ? "Holding it for you…" : children}
    </button>
  );
}

/** The claim form itself, identical whether it sits in a dialog or in the page. */
function ClaimForm({
  item,
  action,
  error,
  onCancel,
}: {
  item: Item;
  action: (formData: FormData) => void;
  error?: string;
  onCancel?: () => void;
}) {
  const list = useList();
  const price = money(item.priceCents, item.currency);
  const blocked = !list.signedIn && !list.allowGuests;

  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={item.id} />

      <div className="flex items-start gap-3 border border-rule bg-bg-sunk p-3">
        <span aria-hidden className="mt-0.5 text-[15px]">
          🤫
        </span>
        <p className="text-[13.5px] leading-[1.5] text-muted pretty">
          Claiming it marks the item as spoken for so two people can&apos;t buy the same thing.{" "}
          {list.ownerFirstName} sees that the list has activity — never the item, never your name.
        </p>
      </div>

      {blocked ? (
        <p className="mt-4 border border-rule bg-bg-sunk p-3 text-[13.5px] text-muted">
          {list.ownerFirstName} asks buyers to sign in first.
        </p>
      ) : null}

      {!list.signedIn && list.allowGuests ? (
        <label className="mt-4 block">
          <span className="label">Your first name — optional</span>
          <input
            name="guestName"
            className="field mt-1.5"
            placeholder="So other buyers know someone real has it"
            maxLength={40}
          />
        </label>
      ) : null}

      <label className="mt-4 block">
        <span className="label">A note to yourself — optional</span>
        <textarea
          name="note"
          className="field mt-1.5 min-h-[72px]"
          placeholder="Size, colour, where you found it cheaper…"
          maxLength={280}
        />
      </label>

      <div className="mt-5">
        {blocked ? (
          <Link
            href={`/login?next=${encodeURIComponent(list.listHref)}`}
            className="btn btn-primary w-full"
          >
            Sign in to claim
          </Link>
        ) : (
          <Submit>Hold {price ? `${item.name} · ${price}` : item.name}</Submit>
        )}

        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm mt-2 w-full text-muted">
            Not this one
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-[13.5px] text-madder">
            {error}
          </p>
        ) : null}

        {!list.signedIn && list.allowGuests ? (
          <p className="mt-3 text-center text-[12.5px] text-faint pretty">
            No account needed.{" "}
            <Link href={`/login?next=${encodeURIComponent(list.listHref)}`} className="link-underline">
              Sign in
            </Link>{" "}
            if you&apos;d rather keep all your gifts in one place.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function ClaimSuccess({
  item,
  entering,
  showTag = true,
}: {
  item: Item;
  entering?: boolean;
  /** The detail view already shows a tag at the top; one is plenty. */
  showTag?: boolean;
}) {
  const list = useList();
  return (
    <div>
      {showTag ? (
        <div className="flex justify-center py-2">
          <HoldTag state="reserved" mine entering={entering} />
        </div>
      ) : null}
      <p className={`voice text-[16px] text-muted pretty ${showTag ? "mt-5 text-center" : ""}`}>
        {item.name} is held for you. Nobody else can claim it, and {list.ownerFirstName} still gets
        the surprise.
      </p>
      <div className="mt-6 space-y-2.5">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
            Buy it at {hostFromUrl(item.url) ?? "the store"}
          </a>
        ) : null}
        <Link href="/gifts" className="btn btn-outline w-full">
          Manage it in Gifts I&apos;m Getting
        </Link>
      </div>
      {list.reservationDays ? (
        <p className={`mt-4 text-[12.5px] text-faint pretty ${showTag ? "text-center" : ""}`}>
          We&apos;ll check in after {list.reservationDays} days. If you change your mind, release it
          and it quietly goes back on the list.
        </p>
      ) : null}
    </div>
  );
}

export function GiftButton({
  item,
  compact,
  block,
  quiet,
  mode = "modal",
}: {
  item: Item;
  compact?: boolean;
  block?: boolean;
  /** The card already carries a hold tag, so skip the redundant text label. */
  quiet?: boolean;
  /**
   * `inline` keeps the whole flow inside whatever surface is already open. The
   * item detail uses it so claiming never stacks a second overlay on the first
   * — two scrims turn everything behind them black.
   */
  mode?: "modal" | "inline";
}) {
  const list = useList();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<GiftState, FormData>(reserveAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "reserved") toast("Held for you. They will not see it was you.", { tone: "good" });
    if (state.status === "error") toast(state.message, { tone: "warn" });
  }, [state, toast]);

  const claimed = item.giftState === "reserved" || item.giftState === "purchased";
  const justClaimed = state.status === "reserved";
  const error = state.status === "error" ? state.message : undefined;

  // ------------------------------------------------------------ inline mode
  if (mode === "inline") {
    if (justClaimed) {
      return (
        <div className="border-l-2 border-accent bg-accent-quiet px-4 py-5 sm:px-5">
          <ClaimSuccess item={item} showTag={false} />
        </div>
      );
    }
    if (item.reservedByViewer) {
      return (
        <Link href="/gifts" className="btn btn-outline w-full">
          In your gifts
        </Link>
      );
    }
    if (claimed) {
      return quiet ? null : (
        <span className="label text-faint">
          {item.giftState === "purchased" ? "Already bought" : "Spoken for"}
        </span>
      );
    }
    if (!open) {
      return (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary w-full">
          <span aria-hidden>🎁</span>
          I&apos;ll get this
        </button>
      );
    }
    return (
      <div className="border-l-2 border-accent bg-accent-quiet px-4 py-4 sm:px-5">
        <h4 className="display text-[17px]">Getting this for {list.ownerFirstName}?</h4>
        <p className="mt-1 text-[13px] text-muted pretty">
          {list.ownerFirstName} will never see who claimed it.
        </p>
        <div className="mt-4">
          <ClaimForm item={item} action={action} error={error} onCancel={() => setOpen(false)} />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- modal mode
  const trigger =
    item.reservedByViewer || justClaimed ? (
      <Link href="/gifts" className={`btn btn-outline btn-sm ${block ? "w-full" : ""}`}>
        In your gifts
      </Link>
    ) : claimed ? (
      quiet ? null : (
        <span className="label text-faint">
          {item.giftState === "purchased" ? "Already bought" : "Spoken for"}
        </span>
      )
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn ${compact ? "btn-outline btn-sm" : "btn-primary"} ${block ? "w-full" : ""}`}
      >
        <span aria-hidden>🎁</span>
        I&apos;ll get this
      </button>
    );

  return (
    <>
      {trigger}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={justClaimed ? "It's yours to give" : `Getting this for ${list.ownerFirstName}?`}
        description={
          justClaimed
            ? undefined
            : `${list.ownerFirstName} will never see who claimed it — only that something on the list has been spoken for.`
        }
        size="sm"
        ground={list.ground}
      >
        <div className="px-5 py-5 sm:px-6">
          {justClaimed ? (
            <ClaimSuccess item={item} entering />
          ) : (
            <ClaimForm item={item} action={action} error={error} />
          )}
        </div>
      </Modal>
    </>
  );
}
