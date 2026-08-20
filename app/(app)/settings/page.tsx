import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import {
  GiftingSettings,
  NotificationSettings,
  ProfileSettings,
} from "@/components/app/settings-forms";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { id: "profile", label: "Profile and privacy" },
  { id: "gifting", label: "Gifting" },
  { id: "notifications", label: "Notifications" },
  { id: "account", label: "Account" },
];

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-3">
        <h1 className="display text-[clamp(1.875rem,5vw,2.25rem)]">Settings</h1>
        <nav aria-label="Settings sections" className="mt-5 hidden lg:block">
          <ul className="space-y-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block py-1 text-[14px] text-muted transition-colors hover:text-fg"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="space-y-14 lg:col-span-9">
        <section id="profile" className="scroll-mt-24">
          <h2 className="display text-[22px]">Profile and privacy</h2>
          <p className="mt-1.5 text-[14px] text-muted pretty">
            How you appear at{" "}
            <Link href={`/${user.profile.username}`} className="link-underline">
              wishwell.app/{user.profile.username}
            </Link>
            .
          </p>
          <div className="mt-6">
            <ProfileSettings profile={user.profile} email={user.email} />
          </div>
        </section>

        <section id="gifting" className="scroll-mt-24 border-t border-rule pt-10">
          <h2 className="display text-[22px]">Gifting</h2>
          <p className="mt-1.5 max-w-xl text-[14px] text-muted pretty">
            How claims work on your lists — who can make them, how long they last, and how much you
            are willing to know.
          </p>
          <div className="mt-6">
            <GiftingSettings settings={user.settings} />
          </div>
        </section>

        <section id="notifications" className="scroll-mt-24 border-t border-rule pt-10">
          <h2 className="display text-[22px]">Notifications</h2>
          <p className="mt-1.5 text-[14px] text-muted pretty">
            We keep these rare on purpose.
          </p>
          <div className="mt-6">
            <NotificationSettings settings={user.settings} />
          </div>
        </section>

        <section id="account" className="scroll-mt-24 border-t border-rule pt-10">
          <h2 className="display text-[22px]">Account</h2>
          <p className="mt-1.5 text-[14px] text-muted">
            Signed in as {user.email}.
          </p>
          <form action={signOutAction} className="mt-5">
            <button type="submit" className="btn btn-outline btn-sm">
              Sign out
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
