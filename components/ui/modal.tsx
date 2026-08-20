"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/client-hooks";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * One overlay that presents as a centred dialog on large screens and a bottom
 * sheet you can throw away with your thumb on small ones. Same markup, so the
 * focus and escape behaviour cannot drift apart between the two.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  ground = "studio",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  ground?: "studio" | "gallery";
}) {
  const mounted = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const [drag, setDrag] = useState(0);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const widths = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
    full: "sm:max-w-6xl",
  }[size];

  return createPortal(
    <div className={`overlay flex items-end justify-center sm:items-center sm:p-6 ground-${ground}`}>
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`sheet sm:dialog relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg text-fg outline-none sm:rounded-lg ${widths} shadow-[0_30px_80px_-30px_rgba(0,0,0,0.75)]`}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        onPointerDown={(e) => {
          if (window.innerWidth >= 640 || e.pointerType === "mouse") return;
          setDrag(0);
          const startY = e.clientY;
          const target = e.currentTarget;
          const scroller = target.querySelector<HTMLElement>("[data-modal-scroll]");
          if (scroller && scroller.scrollTop > 0) return;
          const move = (ev: PointerEvent) => setDrag(Math.max(0, ev.clientY - startY));
          const up = (ev: PointerEvent) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            if (ev.clientY - startY > 110) onClose();
            else setDrag(0);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <div className="flex items-start gap-4 border-b border-rule px-5 py-4 sm:px-6">
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-rule-strong sm:hidden"
          />
          <div className="min-w-0 flex-1 pt-1 sm:pt-0">
            <h2 id={titleId} className="display text-[19px] leading-tight">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-[13.5px] text-muted pretty">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost -mr-2 -mt-1 min-h-0 p-2 text-muted hover:text-fg"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
        <div data-modal-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
