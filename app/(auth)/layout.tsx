import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ground-studio min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:min-h-0">
        <header className="flex items-center justify-between">
          <Wordmark />
          <Link href="/" className="label transition-colors hover:text-fg">
            Back to home
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[26rem]">{children}</div>
        </main>
        <footer className="label">Wishwell — a kinder way to be given things.</footer>
      </div>

      {/* The gallery, standing behind the door you are about to walk through. */}
      <aside className="ground-gallery relative hidden bg-bg lg:block">
        <Image
          src="/media/cover-photography.jpg"
          alt=""
          fill
          sizes="50vw"
          className="object-cover opacity-70"
          priority
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[color-mix(in_oklab,var(--color-bg)_30%,transparent)] to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <blockquote className="voice-em max-w-md text-[clamp(1.375rem,2.4vw,1.875rem)] leading-[1.35] text-fg balance">
            “I have been shooting on a borrowed body for two years, and I am tired of handing it
            back.”
          </blockquote>
          <p className="label mt-4">Hunter, on the one thing he actually wants</p>
        </div>
      </aside>
    </div>
  );
}
