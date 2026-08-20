"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/bits";

type NavUser = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

const TABS = [
  { href: "/dashboard", label: "Lists", icon: ListIcon },
  { href: "/gifts", label: "Gifts", icon: GiftIcon },
  { href: "/notifications", label: "Alerts", icon: BellIcon },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ user, unread }: { user: NavUser; unread: number }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={isActive(pathname, tab.href) ? "page" : undefined}
          className={`btn btn-sm relative gap-2 ${
            isActive(pathname, tab.href) ? "text-fg" : "text-muted hover:text-fg"
          }`}
        >
          <tab.icon />
          {tab.label}
          {tab.href === "/notifications" && unread > 0 ? (
            <span className="numeric ml-0.5 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-semibold text-on-accent">
              {unread}
            </span>
          ) : null}
          {isActive(pathname, tab.href) ? (
            <span aria-hidden className="absolute inset-x-3 -bottom-px h-px bg-accent" />
          ) : null}
        </Link>
      ))}

      <div className="relative ml-2">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-full border border-rule-strong py-1 pl-1 pr-3 transition-colors hover:border-fg"
        >
          <Avatar name={user.displayName} src={user.avatarUrl} size={28} />
          <span className="text-[13.5px] font-medium">{user.displayName.split(" ")[0]}</span>
        </button>

        {menu ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close menu"
              onClick={() => setMenu(false)}
            />
            <div
              role="menu"
              className="dialog absolute right-0 z-20 mt-2 w-56 border border-rule bg-surface py-1.5 shadow-[0_20px_50px_-24px_rgba(20,12,16,0.5)]"
            >
              <Link
                role="menuitem"
                href={`/${user.username}`}
                onClick={() => setMenu(false)}
                className="block px-4 py-2 text-[14px] hover:bg-bg-sunk"
              >
                Your public profile
                <span className="label mt-0.5 block normal-case tracking-normal">
                  wishwell.app/{user.username}
                </span>
              </Link>
              <Link
                role="menuitem"
                href="/settings"
                onClick={() => setMenu(false)}
                className="block px-4 py-2 text-[14px] hover:bg-bg-sunk"
              >
                Settings and privacy
              </Link>
              <div className="my-1.5 border-t border-rule" />
              <form action={signOutAction}>
                <button
                  role="menuitem"
                  type="submit"
                  className="w-full px-4 py-2 text-left text-[14px] hover:bg-bg-sunk"
                >
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}

export function MobileNav({ user, unread }: { user: NavUser; unread: number }) {
  const pathname = usePathname();
  const tabs = [
    ...TABS,
    { href: "/settings", label: "You", icon: PersonIcon },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-[color-mix(in_oklab,var(--color-bg)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-[0.02em] transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="relative">
                  <tab.icon />
                  {tab.href === "/notifications" && unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-accent" />
                  ) : null}
                </span>
                {tab.label}
                {active ? (
                  <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 bg-accent" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="sr-only">Signed in as {user.displayName}</span>
    </nav>
  );
}

/* ------------------------------------------------------------------- icons */

function ListIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2.5" y="3" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="3" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="10" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="10" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M2.5 7.5h13V15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V7.5Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 5h15v2.5h-15z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 5v11M9 5S7.6 2 5.9 2 3.9 5 6 5h3Zm0 0s1.4-3 3.1-3 2 3-.1 3H9Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4.5 7a4.5 4.5 0 0 1 9 0c0 3 1 4.5 1 4.5h-11S4.5 10 4.5 7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7.5 14a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 15.5c.8-2.7 2.9-4 5.5-4s4.7 1.3 5.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
