"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { reorderItemsAction } from "@/lib/actions/lists";

type Row = { id: string; name: string; content: React.ReactNode };
type Control = "up" | "down" | "grip";
type Status = "idle" | "saving" | "saved" | "error";

type Drag = {
  id: string;
  pointerId: number;
  pointerY: number;
  grabOffset: number;
  translate: number;
  startOrder: string[];
};

const EDGE = 72;

function move(order: string[], id: string, to: number) {
  const next = order.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}

function Arrow({ up }: { up?: boolean }) {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12">
      <path
        d={up ? "M2.5 7.5 6 4l3.5 3.5" : "M2.5 4.5 6 8l3.5-3.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Grip() {
  return (
    <svg aria-hidden width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      {[2, 8, 14].map((y) => (
        <g key={y}>
          <circle cx="2.5" cy={y} r="1.4" />
          <circle cx="7.5" cy={y} r="1.4" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The owner's say over what visitors see first. Three ways to move an item, so
 * nobody is left out: drag the handle (mouse or finger, and the page scrolls
 * when you reach an edge), press the arrows, or focus the handle and use the
 * arrow keys, Home and End.
 *
 * The list moves the moment you ask and saves a beat later, so a run of quick
 * presses becomes one save. If a save fails, the list goes back to the last
 * order that did save and says so.
 */
export function ItemOrder({ listId, rows }: { listId: string; rows: Row[] }) {
  const ids = rows.map((r) => r.id);
  const setKey = [...ids].sort().join(",");
  const [order, setOrder] = useState(ids);
  const [syncedKey, setSyncedKey] = useState(setKey);
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [announcement, setAnnouncement] = useState("");
  const helpId = useId();

  // An item added or removed on the server resets the order to the server's.
  // A change of order alone is ours, echoed back, and is ignored.
  if (setKey !== syncedKey) {
    setSyncedKey(setKey);
    setOrder(ids);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const orderRef = useRef(order);
  const saved = useRef(ids);
  const pending = useRef<string[] | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<{ id: string; control: Control } | null>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    orderRef.current = order;
    const want = refocus.current;
    if (!want) return;
    refocus.current = null;
    const pick = (c: Control) => controls.current.get(`${want.id}:${c}`);
    let el = pick(want.control);
    if (!el || el.disabled) el = pick(want.control === "up" ? "down" : want.control === "down" ? "up" : "grip");
    if (el && !el.disabled) el.focus();
  }, [order]);

  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [status]);

  // No text gets selected while a row is being dragged across it.
  useEffect(() => {
    if (!dragging) return;
    const body = document.body;
    body.style.userSelect = "none";
    return () => {
      body.style.userSelect = "";
    };
  }, [dragging]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  async function flush() {
    if (inFlight.current || !pending.current) return;
    const next = pending.current;
    pending.current = null;
    inFlight.current = true;
    setStatus("saving");
    try {
      const result = await reorderItemsAction(listId, next);
      if (!result.ok) throw new Error(result.error);
      saved.current = next;
      if (!pending.current) setStatus("saved");
    } catch {
      if (!pending.current) {
        setOrder(saved.current);
        setStatus("error");
      }
    } finally {
      inFlight.current = false;
      if (pending.current) void flush();
    }
  }

  function save(next: string[]) {
    pending.current = next;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 450);
  }

  function announce(id: string, next: string[]) {
    const name = byId.get(id)?.name ?? "Item";
    setAnnouncement(`${name} moved to position ${next.indexOf(id) + 1} of ${next.length}.`);
  }

  function moveTo(id: string, to: number, control: Control) {
    const from = order.indexOf(id);
    if (to === from || to < 0 || to >= order.length) return;
    const next = move(order, id, to);
    refocus.current = { id, control };
    setOrder(next);
    announce(id, next);
    save(next);
  }

  // ------------------------------------------------------------------ drag

  /** Puts the dragged row wherever its middle now is among the others. */
  function place(d: Drag) {
    const el = rowEls.current.get(d.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = d.pointerY - d.grabOffset + rect.height / 2;
    const current = orderRef.current;
    let target = 0;
    for (const other of current) {
      if (other === d.id) continue;
      const r = rowEls.current.get(other)?.getBoundingClientRect();
      if (r && center > r.top + r.height / 2) target += 1;
    }
    if (target !== current.indexOf(d.id)) {
      const next = move(current, d.id, target);
      orderRef.current = next;
      setOrder(next);
    }
  }

  function tick() {
    const d = drag.current;
    if (!d) return;
    const el = rowEls.current.get(d.id);
    if (!el) return;

    // Scroll when the finger reaches the top or bottom of the screen, faster
    // the further in it goes, so a long list can be crossed in one drag.
    let dy = 0;
    if (d.pointerY < EDGE) dy = -Math.ceil((EDGE - d.pointerY) / 5);
    else if (d.pointerY > window.innerHeight - EDGE)
      dy = Math.ceil((d.pointerY - (window.innerHeight - EDGE)) / 5);
    if (dy) window.scrollBy(0, dy);

    place(d);
    const naturalTop = el.getBoundingClientRect().top - d.translate;
    d.translate = d.pointerY - d.grabOffset - naturalTop;
    el.style.transform = `translateY(${d.translate}px)`;
    frame.current = requestAnimationFrame(tick);
  }

  function startDrag(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0 || order.length < 2) return;
    const el = rowEls.current.get(id);
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id,
      pointerId: e.pointerId,
      pointerY: e.clientY,
      grabOffset: e.clientY - el.getBoundingClientRect().top,
      translate: 0,
      startOrder: order,
    };
    setDragging(id);
    frame.current = requestAnimationFrame(tick);
  }

  function moveDrag(e: React.PointerEvent) {
    if (drag.current?.pointerId === e.pointerId) drag.current.pointerY = e.clientY;
  }

  function endDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (e.type === "pointerup") {
      d.pointerY = e.clientY;
      place(d);
    }
    drag.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    const el = rowEls.current.get(d.id);
    if (el) el.style.transform = "";
    setDragging(null);
    const next = orderRef.current;
    if (next.join() !== d.startOrder.join()) {
      announce(d.id, next);
      save(next);
    }
  }

  function onGripKey(e: React.KeyboardEvent, id: string) {
    const index = order.indexOf(id);
    const to =
      e.key === "ArrowUp" ? index - 1
      : e.key === "ArrowDown" ? index + 1
      : e.key === "Home" ? 0
      : e.key === "End" ? order.length - 1
      : null;
    if (to == null) return;
    e.preventDefault();
    moveTo(id, to, "grip");
  }

  const reorderable = order.length > 1;
  const ref = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) controls.current.set(key, el);
    else controls.current.delete(key);
  };

  return (
    <>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p id={helpId} className="text-[13.5px] text-muted pretty">
          {reorderable
            ? "Visitors see your items in this order. Drag the handle or use the arrows to move one. On the handle, Home and End jump to the top and bottom."
            : "Visitors see your items in this order."}
        </p>
        <p
          role="status"
          className={`label min-h-[1.25rem] ${status === "error" ? "text-madder" : ""}`}
        >
          {status === "saving"
            ? "Saving order…"
            : status === "saved"
              ? "Order saved"
              : status === "error"
                ? "That order did not save, so it went back. Try again."
                : ""}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ul className="mt-4 border-t border-rule">
        {order.map((id, index) => {
          const row = byId.get(id);
          if (!row) return null;
          const lifted = dragging === id;
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) rowEls.current.set(id, el);
                else rowEls.current.delete(id);
              }}
              className={`border-b border-rule bg-bg ${
                lifted
                  ? "relative z-10 border-transparent bg-surface shadow-[0_12px_32px_-12px_rgba(40,20,28,0.35)] ring-1 ring-rule-strong"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3 py-3.5 sm:gap-4">
                {reorderable ? (
                  <div className="-ml-1 flex shrink-0 flex-col items-center">
                    <button
                      ref={ref(`${id}:up`)}
                      type="button"
                      onClick={() => moveTo(id, index - 1, "up")}
                      disabled={index === 0}
                      aria-label={`Move ${row.name} up`}
                      className="flex h-7 w-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-[color-mix(in_oklab,var(--color-fg)_6%,transparent)] hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent"
                    >
                      <Arrow up />
                    </button>
                    <button
                      ref={ref(`${id}:grip`)}
                      type="button"
                      onPointerDown={(e) => startDrag(e, id)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(e) => onGripKey(e, id)}
                      aria-label={`Reorder ${row.name}, position ${index + 1} of ${order.length}`}
                      aria-describedby={helpId}
                      className={`flex h-8 w-9 touch-none items-center justify-center rounded-sm text-faint transition-colors hover:bg-[color-mix(in_oklab,var(--color-fg)_6%,transparent)] hover:text-fg ${
                        lifted ? "cursor-grabbing text-fg" : "cursor-grab"
                      }`}
                    >
                      <Grip />
                    </button>
                    <button
                      ref={ref(`${id}:down`)}
                      type="button"
                      onClick={() => moveTo(id, index + 1, "down")}
                      disabled={index === order.length - 1}
                      aria-label={`Move ${row.name} down`}
                      className="flex h-7 w-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-[color-mix(in_oklab,var(--color-fg)_6%,transparent)] hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent"
                    >
                      <Arrow />
                    </button>
                  </div>
                ) : null}
                {row.content}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
