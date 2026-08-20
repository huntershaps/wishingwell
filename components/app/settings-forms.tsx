"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateGiftingAction,
  updateNotificationsAction,
  updateProfileAction,
  type SettingsState,
} from "@/lib/actions/settings";
import type { Profile, Settings } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

const ACCENTS = [
  { key: "madder", label: "Madder", swatch: "#b0304f" },
  { key: "saffron", label: "Saffron", swatch: "#a96c1e" },
  { key: "moss", label: "Moss", swatch: "#416a4f" },
  { key: "plum", label: "Plum", swatch: "#6b3f78" },
  { key: "indigo", label: "Indigo", swatch: "#3f4f8a" },
];

function Save({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function useSaved(state: SettingsState, message: string) {
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) toast(message, { tone: "good" });
    if (state?.error) toast(state.error, { tone: "warn" });
  }, [state, message, toast]);
}

function Switch({
  name,
  defaultChecked,
  title,
  body,
  onChange,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  body: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-rule py-4 last:border-b-0">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
        className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--color-accent)]"
        style={{ width: 18, height: 18 }}
      />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[13.5px] leading-[1.5] text-muted pretty">{body}</span>
      </span>
    </label>
  );
}

export function ProfileSettings({ profile, email }: { profile: Profile; email: string }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateProfileAction, null);
  const [accent, setAccent] = useState(profile.accent);
  useSaved(state, "Profile updated.");

  return (
    <form action={action} className="space-y-5" data-accent={accent}>
      <input type="hidden" name="accent" value={accent} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Display name</span>
          <input
            name="displayName"
            defaultValue={profile.displayName}
            className="field mt-1.5"
            aria-invalid={state?.field === "displayName"}
            maxLength={60}
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
              defaultValue={profile.username}
              className="field flex-1 rounded-l-none"
              aria-invalid={state?.field === "username"}
              maxLength={24}
            />
          </span>
        </label>
      </div>

      <label className="block">
        <span className="label">Bio</span>
        <textarea
          name="bio"
          defaultValue={profile.bio ?? ""}
          className="field voice mt-1.5 min-h-[76px] text-[16px]"
          placeholder="A few things I love, want, and am saving for."
          maxLength={220}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Location</span>
          <input
            name="location"
            defaultValue={profile.location ?? ""}
            className="field mt-1.5"
            placeholder="Chicago, IL"
            maxLength={60}
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input value={email} readOnly className="field mt-1.5 text-muted" aria-describedby="email-note" />
          <span id="email-note" className="mt-1 block text-[12.5px] text-faint">
            Used for sign in and reminders.
          </span>
        </label>
      </div>

      <fieldset>
        <legend className="label">Links</legend>
        <div className="mt-2 space-y-2">
          {["Portfolio", "Instagram", "Anything else"].map((placeholder, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <input
                name={`linkLabel${i}`}
                defaultValue={profile.links[i]?.label ?? ""}
                className="field"
                placeholder={placeholder}
                maxLength={30}
              />
              <input
                name={`linkUrl${i}`}
                defaultValue={profile.links[i]?.url ?? ""}
                className="field"
                placeholder="https://"
                maxLength={200}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Your accent</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setAccent(option.key)}
              aria-pressed={accent === option.key}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                accent === option.key ? "border-fg" : "border-rule hover:border-rule-strong"
              }`}
            >
              <span aria-hidden className="h-3.5 w-3.5 rounded-full" style={{ background: option.swatch }} />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t border-rule pt-1">
        <legend className="sr-only">Profile privacy</legend>
        <label className="flex cursor-pointer items-start gap-3 border-b border-rule py-4">
          <input
            type="radio"
            name="profileVisibility"
            value="public"
            defaultChecked={profile.visibility === "public"}
            className="mt-0.5 accent-[var(--color-accent)]"
            style={{ width: 18, height: 18 }}
          />
          <span>
            <span className="block text-[14.5px] font-medium">Public profile</span>
            <span className="mt-0.5 block text-[13.5px] text-muted pretty">
              Anyone with your link sees your name, bio, and public lists.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 py-4">
          <input
            type="radio"
            name="profileVisibility"
            value="private"
            defaultChecked={profile.visibility === "private"}
            className="mt-0.5 accent-[var(--color-accent)]"
            style={{ width: 18, height: 18 }}
          />
          <span>
            <span className="block text-[14.5px] font-medium">Private profile</span>
            <span className="mt-0.5 block text-[13.5px] text-muted pretty">
              Your profile page is hidden. Individual lists you share by link still open normally.
            </span>
          </span>
        </label>
        <Switch
          name="discoverable"
          defaultChecked={profile.discoverable}
          title="Let people find me by name"
          body="Turn this off to stay out of search and discovery entirely."
        />
      </fieldset>

      <div className="pt-1">
        <Save label="Save profile" />
      </div>
    </form>
  );
}

export function GiftingSettings({ settings }: { settings: Settings }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateGiftingAction, null);
  const [expires, setExpires] = useState(settings.reservationsExpire);
  useSaved(state, "Gifting preferences saved.");

  return (
    <form action={action} className="space-y-5">
      <div>
        <Switch
          name="surpriseMode"
          defaultChecked={settings.surpriseMode}
          title="Surprise mode"
          body="Keeps you from seeing which of your items have been claimed or bought. You still see that a list has activity. This is the whole point, but it is your call."
        />
        <Switch
          name="allowGuests"
          defaultChecked={settings.allowGuestReservations}
          title="Let people claim gifts without an account"
          body="Friends and family can claim an item with one tap. Turn this off to require sign in."
        />
        <Switch
          name="reservationsExpire"
          defaultChecked={settings.reservationsExpire}
          title="Expire forgotten claims"
          body="If someone claims something and goes quiet, the hold is released so the item is available again."
          onChange={setExpires}
        />
      </div>

      <label className={`block max-w-xs transition-opacity ${expires ? "" : "pointer-events-none opacity-45"}`}>
        <span className="label">Hold length</span>
        <span className="mt-1.5 flex items-stretch">
          <input
            name="reservationDays"
            type="number"
            min={1}
            max={60}
            defaultValue={settings.reservationDays}
            className="field numeric rounded-r-none"
          />
          <span className="flex items-center border border-l-0 border-rule-strong bg-bg-sunk px-3 text-[13px] text-faint">
            days
          </span>
        </span>
      </label>

      <label className="block max-w-xs">
        <span className="label">Default for new lists</span>
        <select name="defaultVisibility" defaultValue={settings.defaultVisibility} className="field mt-1.5">
          <option value="public">Public</option>
          <option value="link">Link only</option>
          <option value="private">Private</option>
        </select>
      </label>

      <div className="pt-1">
        <Save label="Save gifting" />
      </div>
    </form>
  );
}

export function NotificationSettings({ settings }: { settings: Settings }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateNotificationsAction, null);
  useSaved(state, "Notification preferences saved.");

  return (
    <form action={action} className="space-y-5">
      <div>
        <Switch
          name="appNotifications"
          defaultChecked={settings.appNotifications}
          title="In-app notifications"
          body="The bell in the top bar."
        />
        <Switch
          name="emailNotifications"
          defaultChecked={settings.emailNotifications}
          title="Email"
          body="Only for things that need a decision, like a hold about to run out."
        />
        <Switch
          name="notifyGiftActivity"
          defaultChecked={settings.notifyGiftActivity}
          title="Activity on my lists"
          body="A nudge when something happens. With surprise mode on, it never names the item."
        />
        <Switch
          name="notifyReminders"
          defaultChecked={settings.notifyReservationReminders}
          title="Reminders about gifts I'm getting"
          body="A check-in before a hold expires, so nothing quietly falls through."
        />
      </div>
      <div className="pt-1">
        <Save label="Save notifications" />
      </div>
    </form>
  );
}
