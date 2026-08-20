"use client";

import { useEffect, useRef, useState } from "react";
import { useIsClient, usePrefersReducedMotion } from "@/lib/client-hooks";

/**
 * Reveals content once, when it first crosses into view. Elements start hidden
 * only after hydration confirms the observer is available, so a reader with
 * JavaScript off — or a crawler — still gets the whole page.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  variant = "rise",
  className = "",
}: {
  children: React.ReactNode;
  as?: React.ElementType;
  delay?: number;
  variant?: "rise" | "mask";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const isClient = useIsClient();
  const reduced = usePrefersReducedMotion();
  const [seen, setSeen] = useState(false);
  const armed = isClient && !reduced;
  const shown = !armed || seen;

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSeen(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const base = variant === "mask" ? "reveal-mask" : "reveal";
  return (
    <Tag
      ref={ref}
      className={`${armed ? base : ""} ${shown ? "is-in" : ""} ${className}`}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
