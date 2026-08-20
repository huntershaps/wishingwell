import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { listNotifications } from "@/lib/notifications";
import { markNotificationsReadAction } from "@/lib/actions/settings";
import { runReservationMaintenance } from "@/lib/reservations";
import { EmptyState } from "@/components/ui/bits";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

function Row({ notification }: { notification: Notification }) {
  const unread = !notification.readAt;
  const body = (
    <div className="flex gap-3.5 py-4">
      <span
        aria-hidden
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${unread ? "bg-accent" : "bg-transparent"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-snug ${unread ? "font-medium" : ""} pretty`}>
          {notification.title}
        </p>
        {notification.body ? (
          <p className="mt-1 text-[13.5px] text-muted pretty">{notification.body}</p>
        ) : null}
        <p className="label mt-1.5">{relativeTime(notification.createdAt)}</p>
      </div>
    </div>
  );

  return (
    <li className="border-b border-rule">
      {notification.href ? (
        <Link href={notification.href} className="block transition-colors hover:bg-bg-sunk">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

export default async function NotificationsPage() {
  const user = await requireUser();
  runReservationMaintenance();
  const notifications = listNotifications(user.id);
  const owner = notifications.filter((n) => n.audience === "owner");
  const buyer = notifications.filter((n) => n.audience === "buyer");
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(2rem,5vw,2.75rem)]">Notifications</h1>
          <p className="voice mt-2 text-[17px] text-muted pretty">
            {user.settings.surpriseMode
              ? "Anything about your own lists stays deliberately vague."
              : "Surprise mode is off, so updates about your lists name the item."}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markNotificationsReadAction}>
            <button type="submit" className="btn btn-outline btn-sm">
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing to report"
            body="You will hear from us when a list gets activity, or when a gift you claimed needs a decision."
            action={{ label: "Back to your lists", href: "/dashboard" }}
          />
        </div>
      ) : null}

      {buyer.length > 0 ? (
        <section className="mt-9">
          <h2 className="label border-b border-rule pb-2">Gifts you&apos;re getting</h2>
          <ul>
            {buyer.map((n) => (
              <Row key={n.id} notification={n} />
            ))}
          </ul>
        </section>
      ) : null}

      {owner.length > 0 ? (
        <section className="mt-11">
          <h2 className="label border-b border-rule pb-2">Your lists</h2>
          <ul>
            {owner.map((n) => (
              <Row key={n.id} notification={n} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
