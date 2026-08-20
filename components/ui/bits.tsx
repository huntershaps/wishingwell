import Link from "next/link";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  src,
  size = 40,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-sunk text-fg ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="font-medium tracking-[0.02em] text-muted">{initials(name)}</span>
      )}
    </span>
  );
}

/** The signature object: a paper tag tied onto something already spoken for. */
export function HoldTag({
  state,
  mine,
  entering,
  className = "",
}: {
  state: "reserved" | "purchased";
  mine?: boolean;
  entering?: boolean;
  className?: string;
}) {
  const label = mine
    ? state === "purchased"
      ? "You bought this"
      : "You are getting this"
    : state === "purchased"
      ? "Already bought"
      : "Spoken for";
  return (
    <span
      className={`holdtag ${state === "purchased" ? "holdtag-purchased" : ""} ${
        mine ? "holdtag-mine" : ""
      } ${entering ? "holdtag-enter" : ""} ${className}`}
    >
      {label}
    </span>
  );
}

export function Ribbon({ children }: { children: React.ReactNode }) {
  return (
    <span className="label inline-flex items-center gap-1.5 text-accent">
      <span aria-hidden className="h-px w-5 bg-current opacity-50" />
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string };
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border border-dashed border-rule-strong px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-faint">{icon}</div> : null}
      <h3 className="display text-[20px]">{title}</h3>
      <p className="voice mt-2 max-w-sm text-[15px] text-muted pretty">{body}</p>
      {action ? (
        <Link href={action.href} className="btn btn-primary btn-sm mt-5">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="display numeric text-[26px] leading-none">{value}</div>
      <div className="label mt-1.5">{label}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
