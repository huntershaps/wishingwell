"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createListAction, updateListAction, type ListFormState } from "@/lib/actions/lists";
import { slugify } from "@/lib/format";
import type { Wishlist } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

const ACCENTS = [
  { key: "madder", label: "Madder", swatch: "#b0304f" },
  { key: "saffron", label: "Saffron", swatch: "#a96c1e" },
  { key: "moss", label: "Moss", swatch: "#416a4f" },
  { key: "plum", label: "Plum", swatch: "#6b3f78" },
  { key: "indigo", label: "Indigo", swatch: "#3f4f8a" },
];

const VISIBILITY = [
  {
    key: "public",
    title: "Public",
    body: "Anyone can find it from your profile and open it.",
  },
  {
    key: "link",
    title: "Link only",
    body: "Only people you send the link to can open it. Not listed anywhere.",
  },
  {
    key: "private",
    title: "Private",
    body: "Only you. Useful while you are still putting it together.",
  },
];

const ICONS = ["🎓", "🎂", "🎁", "🎄", "💍", "📷", "🎧", "🏡", "✈️", "🃏", "👟", "🐖", "🌿", "✨"];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function ListForm({
  list,
  username,
}: {
  list?: Wishlist;
  username: string;
}) {
  const editing = !!list;
  const [state, action] = useActionState<ListFormState, FormData>(
    editing ? updateListAction : createListAction,
    null,
  );
  const [title, setTitle] = useState(list?.title ?? "");
  const [slug, setSlug] = useState(list?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!list);
  const [icon, setIcon] = useState(list?.icon ?? "");
  const [accent, setAccent] = useState(list?.accent ?? "madder");
  const [visibility, setVisibility] = useState(list?.visibility ?? "link");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (state?.error) toast(state.error, { tone: "warn" });
  }, [state, toast]);

  const effectiveSlug = slugTouched ? slug : slugify(title);

  return (
    <form action={action} className="space-y-8" data-accent={accent}>
      {editing ? <input type="hidden" name="listId" value={list.id} /> : null}
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="icon" value={icon} />

      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="label">List name</span>
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field mt-1.5 text-[18px]"
            placeholder="Graduation"
            maxLength={80}
            aria-invalid={state?.field === "title"}
            data-autofocus
          />
        </label>
        <fieldset className="sm:pb-1">
          <legend className="label">Icon</legend>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ICONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setIcon(icon === option ? "" : option)}
                aria-pressed={icon === option}
                className={`flex h-9 w-9 items-center justify-center rounded-sm border text-[17px] transition-colors ${
                  icon === option ? "border-accent bg-accent-quiet" : "border-rule hover:border-fg"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="block">
        <span className="label">Description</span>
        <span className="ml-2 text-[12px] text-faint">what this list is for</span>
        <textarea
          name="description"
          defaultValue={list?.description ?? ""}
          className="field voice mt-1.5 min-h-[84px] text-[16px]"
          placeholder="Walking in September. My family keeps asking, so here it is."
          maxLength={400}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">Cover photo</span>
          <input
            name="cover"
            type="file"
            accept="image/*"
            className="field mt-1.5 cursor-pointer py-2.5 text-[13px] file:mr-3 file:rounded-sm file:border-0 file:bg-bg-sunk file:px-3 file:py-1.5 file:text-[13px]"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              setCoverPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          {coverPreview || list?.coverUrl ? (
            <span className="mt-2 block h-28 w-full overflow-hidden bg-bg-sunk">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreview ?? list?.coverUrl ?? ""}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          ) : null}
        </label>

        <div className="space-y-5">
          <label className="block">
            <span className="label">Date</span>
            <span className="ml-2 text-[12px] text-faint">optional</span>
            <input
              name="eventDate"
              type="date"
              defaultValue={
                list?.eventDate ? new Date(list.eventDate).toISOString().slice(0, 10) : ""
              }
              className="field mt-1.5"
            />
          </label>
          <label className="block">
            <span className="label">Occasion</span>
            <input
              name="occasion"
              defaultValue={list?.occasion ?? ""}
              className="field mt-1.5"
              placeholder="graduation, birthday, wedding…"
              maxLength={40}
            />
          </label>
        </div>
      </div>

      <fieldset>
        <legend className="label">Accent</legend>
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
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full"
                style={{ background: option.swatch }}
              />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Who can see it</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {VISIBILITY.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setVisibility(option.key as typeof visibility)}
              aria-pressed={visibility === option.key}
              className={`border p-3.5 text-left transition-colors ${
                visibility === option.key
                  ? "border-accent bg-accent-quiet"
                  : "border-rule hover:border-rule-strong"
              }`}
            >
              <span className="block text-[14.5px] font-medium">{option.title}</span>
              <span className="mt-1 block text-[13px] leading-[1.45] text-muted pretty">
                {option.body}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Custom link</span>
        <span className="mt-1.5 flex items-stretch">
          <span className="flex items-center border border-r-0 border-rule-strong bg-bg-sunk px-3 text-[13px] text-faint">
            wishwell.app/{username}/
          </span>
          <input
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className="field flex-1 rounded-l-none"
            placeholder="graduation"
            maxLength={48}
          />
        </span>
      </label>

      <div className="flex items-center gap-3 border-t border-rule pt-6">
        <Submit label={editing ? "Save list" : "Create list"} />
        {state && !state.error && editing ? (
          <span className="text-[13.5px] text-moss">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
