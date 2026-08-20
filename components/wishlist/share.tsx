"use client";

import { useState } from "react";
import { useOrigin } from "@/lib/client-hooks";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function ShareButton({
  path,
  title,
  description,
  coverUrl,
  icon,
  ownerName,
  variant = "outline",
  label = "Share",
  ground = "gallery",
}: {
  path: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  icon?: string | null;
  ownerName: string;
  variant?: "outline" | "primary" | "ghost";
  label?: string;
  ground?: "studio" | "gallery";
}) {
  const [open, setOpen] = useState(false);
  const url = `${useOrigin()}${path}`;
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied. Send it to whoever needs it.", { tone: "good" });
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast("Copying was blocked. Select the link and copy it manually.", { tone: "warn" });
    }
  }

  async function nativeShare() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, text: description ?? undefined, url });
    } catch {
      /* the person closed the sheet — nothing to report */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn btn-sm ${
          variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn-outline"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none">
          <path
            d="M7 9.5V1.5M7 1.5L4.2 4.3M7 1.5l2.8 2.8M1.5 8.5v3a1 1 0 001 1h9a1 1 0 001-1v-3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Share this list"
        description="Anyone with the link can see it and claim a gift. They never need an account."
        size="sm"
        ground={ground}
      >
        <div className="px-5 py-5 sm:px-6">
          {/* A preview of what lands in the message, so nobody has to guess. */}
          <div className="overflow-hidden border border-rule bg-surface">
            <div className="relative aspect-[16/9] bg-bg-sunk">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="border-t border-rule px-4 py-3">
              <p className="display text-[16px]">
                {icon ? <span className="mr-1.5">{icon}</span> : null}
                {title}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted pretty">
                {description || `${ownerName} on Wishwell`}
              </p>
              <p className="label mt-2 truncate">{url.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>

          <div className="mt-4 flex items-stretch gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="field flex-1 font-mono text-[12.5px]"
              aria-label="Share link"
              data-autofocus
            />
            <button type="button" onClick={copy} className="btn btn-primary shrink-0">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <button type="button" onClick={nativeShare} className="btn btn-outline mt-2 w-full sm:hidden">
            Share another way
          </button>

          <p className="mt-4 text-[12.5px] text-faint pretty">
            Claims stay private. {ownerName.split(" ")[0]} only ever sees that the list has activity.
          </p>
        </div>
      </Modal>
    </>
  );
}
