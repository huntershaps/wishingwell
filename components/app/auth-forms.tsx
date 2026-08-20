"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, signUpAction, type FormState } from "@/lib/actions/auth";
import { slugify } from "@/lib/format";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "One moment…" : label}
    </button>
  );
}

function Error({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="border-l-2 border-madder bg-accent-quiet px-3 py-2 text-[13.5px]">
      {state.error}
    </p>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  function fillDemo() {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("email") as HTMLInputElement).value = "hunter@wishwell.app";
    (form.elements.namedItem("password") as HTMLInputElement).value = "wishwell";
    form.requestSubmit();
  }

  return (
    <>
      <h1 className="display text-[clamp(2rem,5vw,2.5rem)]">Welcome back</h1>
      <p className="voice mt-2 text-[17px] text-muted">Your lists are where you left them.</p>

      <form ref={formRef} action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Error state={state} />
        <label className="block">
          <span className="label">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field mt-1.5"
            placeholder="you@example.com"
            aria-invalid={state?.field === "email"}
          />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field mt-1.5"
            placeholder="••••••••"
          />
        </label>
        <Submit label="Sign in" />
      </form>

      <div className="mt-6 border border-rule bg-surface p-4">
        <p className="text-[13.5px] text-muted pretty">
          <span className="font-medium text-fg">Looking around?</span> The demo account has four
          lists, a few claimed gifts, and surprise mode switched on.
        </p>
        <button type="button" onClick={fillDemo} className="btn btn-outline btn-sm mt-3 w-full">
          Sign in as Hunter
        </button>
      </div>

      <p className="mt-6 text-[14px] text-muted">
        New here?{" "}
        <Link href="/signup" className="link-underline text-fg">
          Make an account
        </Link>
      </p>
    </>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUpAction, null);
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <>
      <h1 className="display text-[clamp(2rem,5vw,2.5rem)]">Start your list</h1>
      <p className="voice mt-2 text-[17px] text-muted pretty">
        One list, one thing on it. That is a real start.
      </p>

      <form action={action} className="mt-8 space-y-4">
        <Error state={state} />
        <label className="block">
          <span className="label">Your name</span>
          <input
            name="name"
            required
            autoComplete="name"
            className="field mt-1.5"
            placeholder="Hunter Shapiro"
            aria-invalid={state?.field === "name"}
            onChange={(e) => {
              if (!touched) setUsername(slugify(e.target.value).replace(/-/g, ""));
            }}
          />
        </label>
        <label className="block">
          <span className="label">Username</span>
          <span className="mt-1.5 flex items-stretch">
            <span className="flex items-center border border-r-0 border-rule-strong bg-bg-sunk px-3 text-[13px] text-faint">
              wishwell.app/
            </span>
            <input
              name="username"
              required
              value={username}
              onChange={(e) => {
                setTouched(true);
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              }}
              className="field flex-1 rounded-l-none"
              placeholder="hunter"
              maxLength={24}
              aria-invalid={state?.field === "username"}
            />
          </span>
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field mt-1.5"
            placeholder="you@example.com"
            aria-invalid={state?.field === "email"}
          />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            className="field mt-1.5"
            placeholder="At least 8 characters"
            aria-invalid={state?.field === "password"}
          />
        </label>
        <Submit label="Create account" />
      </form>

      <p className="mt-6 text-[14px] text-muted">
        Already have one?{" "}
        <Link href="/login" className="link-underline text-fg">
          Sign in
        </Link>
      </p>
    </>
  );
}
