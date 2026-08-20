"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { extendAction, purchaseAction, releaseAction } from "@/lib/actions/gifts";
import { useToast } from "@/components/ui/toast";

function Button({ label, busy, className }: { label: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

function useResult(state: { status?: string } | null, messages: Record<string, string>) {
  const toast = useToast();
  useEffect(() => {
    if (!state?.status) return;
    const message = messages[state.status];
    if (message) toast(message, { tone: state.status === "error" ? "warn" : "good" });
  }, [state, messages, toast]);
}

export function MarkPurchased({ reservationId, itemId }: { reservationId: string; itemId: string }) {
  const [state, action] = useActionState(purchaseAction, null);
  useResult(state, {
    purchased: "Marked as bought. It stays hidden from them.",
    error: "That could not be updated.",
  });
  return (
    <form action={action}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="itemId" value={itemId} />
      <Button label="Mark as bought" busy="Saving…" className="btn btn-primary btn-sm" />
    </form>
  );
}

export function ReleaseHold({ reservationId, itemId }: { reservationId: string; itemId: string }) {
  const [state, action] = useActionState(releaseAction, null);
  useResult(state, {
    released: "Released. It is back on their list for someone else.",
    error: "That could not be released.",
  });
  return (
    <form action={action}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="itemId" value={itemId} />
      <Button
        label="Release"
        busy="Releasing…"
        className="btn btn-ghost btn-sm text-muted hover:text-fg"
      />
    </form>
  );
}

export function ExtendHold({ reservationId, itemId }: { reservationId: string; itemId: string }) {
  const [state, action] = useActionState(extendAction, null);
  useResult(state, {
    extended: "Hold extended. No rush.",
    error: "That hold could not be extended.",
  });
  return (
    <form action={action}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="itemId" value={itemId} />
      <Button label="Still on it" busy="Extending…" className="btn btn-outline btn-sm" />
    </form>
  );
}
