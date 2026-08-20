import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { DesktopNav, MobileNav } from "@/components/app/nav";

export type ShellUser = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  accent: string;
};

/**
 * The studio chrome. Signed-out visitors can reach one page inside it — the
 * gifts they claimed as a guest — so the shell has to work without an account.
 */
export function AppShell({
  user,
  unread,
  children,
}: {
  user: ShellUser | null;
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="ground-studio min-h-dvh bg-bg text-fg" data-accent={user?.accent ?? "madder"}>
      <header className="sticky top-0 z-30 border-b border-rule bg-[color-mix(in_oklab,var(--color-bg)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Wordmark href={user ? "/dashboard" : "/"} size="sm" />

          {user ? (
            <>
              <DesktopNav user={user} unread={unread} />
              <Link href="/settings" className="md:hidden">
                <span className="sr-only">Settings</span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-[12px] font-medium"
                >
                  {user.displayName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")}
                </span>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-ghost btn-sm text-muted hover:text-fg">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-outline btn-sm">
                Create an account
              </Link>
            </div>
          )}
        </div>
      </header>

      <main
        id="main"
        className={`mx-auto max-w-[1240px] px-5 pt-6 sm:px-8 sm:pb-16 sm:pt-10 ${
          user ? "pb-28" : "pb-16"
        }`}
      >
        {children}
      </main>

      {user ? <MobileNav user={user} unread={unread} /> : null}
    </div>
  );
}
