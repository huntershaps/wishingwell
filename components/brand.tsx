import Link from "next/link";

/** The mark is the hold tag — the object the whole product is built around. */
export function TagMark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M2.6 9.1 9.2 2.5a2 2 0 0 1 1.4-.6h5.1a2 2 0 0 1 2 2v5.1a2 2 0 0 1-.6 1.4l-6.6 6.6a2 2 0 0 1-2.8 0L2.6 11.9a2 2 0 0 1 0-2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="13.6" cy="6.4" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  className = "",
  size = "md",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const content = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <TagMark size={size === "sm" ? 16 : 19} className="text-accent" />
      <span
        className="display tracking-[-0.03em]"
        style={{ fontSize: size === "sm" ? 16 : 18, fontWeight: 600 }}
      >
        Wishwell
      </span>
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center rounded-sm" aria-label="Wishwell home">
      {content}
    </Link>
  );
}
