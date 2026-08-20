"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createItemAction, updateItemAction, type ListFormState } from "@/lib/actions/lists";
import { PRIORITY } from "@/lib/format";
import type { Item, Priority } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const PRIORITIES: Priority[] = ["dream", "high", "medium", "someday"];

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule px-5 py-5 first:border-t-0 sm:px-6">
      <h3 className="label">{title}</h3>
      {hint ? <p className="mt-1 text-[13px] text-faint pretty">{hint}</p> : null}
      <div className="mt-3.5 space-y-3.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint ? <span className="ml-2 text-[12px] normal-case tracking-normal text-faint">{hint}</span> : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function SaveBar({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-rule bg-bg px-5 py-3.5 sm:px-6">
      <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={pending}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Add to list"}
      </button>
    </div>
  );
}

export function ItemComposer({
  listId,
  listTitle,
  item,
  trigger,
}: {
  listId: string;
  listTitle: string;
  item?: Item;
  trigger: { label: string; className?: string };
}) {
  const editing = !!item;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ListFormState, FormData>(
    editing ? updateItemAction : createItemAction,
    null,
  );
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(item?.priority ?? "medium");
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const wasPending = useRef(false);

  // A null state after a submit means the action accepted it.
  useEffect(() => {
    if (!open) return;
    if (state === null && wasPending.current) {
      toast(editing ? "Item updated." : "Added to the list.", { tone: "good" });
      setOpen(false);
      setPhotos([]);
      setVideo(null);
      formRef.current?.reset();
    }
    if (state?.error) toast(state.error, { tone: "warn" });
    wasPending.current = false;
  }, [state, open, editing, toast]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={trigger.className ?? "btn btn-primary btn-sm"}>
        {trigger.label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${item.name}` : `Add to ${listTitle}`}
        description={
          editing ? undefined : "The more you say about why, the easier you are to shop for."
        }
        size="lg"
      >
        <form
          ref={formRef}
          action={action}
          onSubmit={() => {
            wasPending.current = true;
          }}
        >
          <input type="hidden" name={editing ? "itemId" : "listId"} value={editing ? item.id : listId} />
          <input type="hidden" name="priority" value={priority} />

          <Section title="The thing itself">
            <Field label="Name">
              <input
                name="name"
                required
                defaultValue={item?.name}
                className="field"
                placeholder="Sony α7 IV"
                data-autofocus
                maxLength={120}
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Link" hint="where you found it">
                <input
                  name="url"
                  type="url"
                  defaultValue={item?.url ?? ""}
                  className="field"
                  placeholder="https://"
                />
              </Field>
              <Field label="Store">
                <input name="store" defaultValue={item?.store ?? ""} className="field" placeholder="B&H Photo" />
              </Field>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Price">
                <input
                  name="price"
                  inputMode="decimal"
                  defaultValue={item?.priceCents != null ? (item.priceCents / 100).toFixed(2) : ""}
                  className="field numeric"
                  placeholder="2498.00"
                />
              </Field>
              <Field label="Currency">
                <select name="currency" defaultValue={item?.currency ?? "USD"} className="field">
                  <option value="USD">USD — US dollar</option>
                  <option value="EUR">EUR — euro</option>
                  <option value="GBP">GBP — pound</option>
                  <option value="CAD">CAD — Canadian dollar</option>
                  <option value="AUD">AUD — Australian dollar</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section
            title="Show it"
            hint="Photos carry the list. A short video saying why carries it further."
          >
            <div className="flex flex-wrap gap-2.5">
              {item?.media.map((m) => (
                <span
                  key={m.id}
                  className="relative h-20 w-20 overflow-hidden border border-rule bg-bg-sunk"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.kind === "video" ? (m.posterUrl ?? m.url) : m.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
              {photos.map((p) => (
                <span key={p.url} className="relative h-20 w-20 overflow-hidden border border-accent">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
              {video ? (
                <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden border border-accent bg-bg-sunk">
                  <video src={video} className="h-full w-full object-cover" muted playsInline />
                </span>
              ) : null}
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Photos" hint="up to 8MB each">
                <input
                  name="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="field cursor-pointer py-2.5 text-[13px] file:mr-3 file:rounded-sm file:border-0 file:bg-bg-sunk file:px-3 file:py-1.5 file:text-[13px]"
                  onChange={(e) =>
                    setPhotos(
                      [...(e.currentTarget.files ?? [])].map((f) => ({
                        name: f.name,
                        url: URL.createObjectURL(f),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Video note" hint="up to 40MB">
                <input
                  name="video"
                  type="file"
                  accept="video/*"
                  className="field cursor-pointer py-2.5 text-[13px] file:mr-3 file:rounded-sm file:border-0 file:bg-bg-sunk file:px-3 file:py-1.5 file:text-[13px]"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    setVideo(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Why you want it"
            hint="This is the part people actually read. Say it the way you would say it out loud."
          >
            <textarea
              name="why"
              defaultValue={item?.whyWant ?? ""}
              className="field voice min-h-[130px] text-[16px] leading-[1.6]"
              placeholder="I have been shooting on a borrowed body for two years and I am tired of handing it back…"
              maxLength={1200}
            />
            <Field label="Description" hint="the practical details">
              <textarea
                name="description"
                defaultValue={item?.description ?? ""}
                className="field min-h-[72px]"
                placeholder="33MP full frame, body only — the lens is further down this list."
                maxLength={600}
              />
            </Field>
          </Section>

          <Section title="Details">
            <fieldset>
              <legend className="label">How much do you want it?</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRIORITIES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPriority(key)}
                    aria-pressed={priority === key}
                    className={`btn btn-sm rounded-full ${
                      priority === key ? "bg-fg text-bg" : "btn-outline text-muted"
                    }`}
                  >
                    {PRIORITY[key].label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-faint">{PRIORITY[priority].hint}</p>
            </fieldset>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Category">
                <input name="category" defaultValue={item?.category ?? ""} className="field" placeholder="Cameras" />
              </Field>
              <Field label="Tags" hint="comma separated">
                <input
                  name="tags"
                  defaultValue={item?.tags.join(", ") ?? ""}
                  className="field"
                  placeholder="full frame, mirrorless"
                />
              </Field>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Size">
                <input name="size" defaultValue={item?.size ?? ""} className="field" placeholder="US 10.5" />
              </Field>
              <Field label="Colour">
                <input name="color" defaultValue={item?.color ?? ""} className="field" placeholder="Black" />
              </Field>
              <Field label="Variation">
                <input name="variant" defaultValue={item?.variant ?? ""} className="field" placeholder="Body only" />
              </Field>
            </div>

            <Field label="Private note" hint="only you can see this">
              <input
                name="notes"
                defaultValue={item?.notes ?? ""}
                className="field"
                placeholder="Wait for the October sale"
              />
            </Field>

            <label className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                name="feature"
                defaultChecked={item?.feature}
                className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="text-[14px] text-muted pretty">
                <span className="text-fg">Feature this one.</span> It gets the big treatment at the
                top of the list.
              </span>
            </label>
          </Section>

          <SaveBar editing={editing} onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}
