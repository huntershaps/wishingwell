import { getCurrentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app/shell";

/**
 * Gifts is the one page inside the studio a guest can reach: anyone who claimed
 * something without an account still needs somewhere to manage it.
 */
export default async function GiftsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <AppShell
      user={
        user
          ? {
              displayName: user.profile.displayName,
              username: user.profile.username,
              avatarUrl: user.profile.avatarUrl,
              accent: user.profile.accent,
            }
          : null
      }
      unread={user ? unreadCount(user.id) : 0}
    >
      {children}
    </AppShell>
  );
}
