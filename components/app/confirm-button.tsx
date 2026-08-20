"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function Inner({
  label,
  confirmLabel,
  armed,
  onArm,
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel: string;
  armed: boolean;
  onArm: () => void;
  onConfirm: () => void;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      // Deliberately never a submit button. Switching `type` inside the click
      // handler flips the attribute before the browser performs the click's
      // default action, so the very first press would submit the form — which
      // is exactly the confirmation this control exists to require.
      type="button"
      onClick={() => (armed ? onConfirm() : onArm())}
      disabled={pending}
      aria-live="polite"
      className={`${className} ${armed ? "text-madder" : ""}`}
    >
      {pending ? "Removing…" : armed ? confirmLabel : label}
    </button>
  );
}

/**
 * Two-step delete. The first press arms it, the second commits, and it disarms
 * itself after a few seconds — no dialog to dismiss for a reversible tidy-up.
 */
export function ConfirmButton({
  action,
  hidden,
  label = "Remove",
  confirmLabel = "Tap again to remove",
  className = "btn btn-ghost btn-sm text-muted hover:text-fg",
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  label?: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer.current);
  }, [armed]);

  return (
    <form ref={formRef} action={action} className="inline">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <Inner
        label={label}
        confirmLabel={confirmLabel}
        armed={armed}
        onArm={() => setArmed(true)}
        onConfirm={() => formRef.current?.requestSubmit()}
        className={className}
      />
    </form>
  );
}
