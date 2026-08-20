import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  return (
    <AppShell
      user={{
        displayName: user.profile.displayName,
        username: user.profile.username,
        avatarUrl: user.profile.avatarUrl,
        accent: user.profile.accent,
      }}
      unread={unreadCount(user.id)}
    >
      {children}
    </AppShell>
  );
}
