import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ListForm } from "@/components/app/list-form";

export const metadata: Metadata = { title: "New list" };

export default async function NewListPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="label mb-6">
        <Link href="/dashboard" className="transition-colors hover:text-fg">
          ← Your lists
        </Link>
      </nav>
      <h1 className="display text-[clamp(2rem,5vw,2.5rem)]">Start a list</h1>
      <p className="voice mt-2 max-w-xl text-[17px] text-muted pretty">
        A list works best when it is about something: a date, an occasion, a corner of your life.
        You can change any of this later.
      </p>
      <div className="mt-9">
        <ListForm username={user.profile.username} />
      </div>
    </div>
  );
}
