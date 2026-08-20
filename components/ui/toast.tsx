"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Tone = "neutral" | "good" | "warn";
type Toast = { id: number; message: string; tone: Tone; action?: { label: string; href: string } };

const ToastContext = createContext<{
  toast: (message: string, opts?: { tone?: Tone; action?: Toast["action"] }) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext).toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback<
    (message: string, opts?: { tone?: Tone; action?: Toast["action"] }) => void
  >((message, opts) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone: opts?.tone ?? "neutral", action: opts?.action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:pr-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="dialog pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-sm border px-4 py-3 text-sm shadow-[0_18px_40px_-16px_rgba(20,12,16,0.5)]"
            style={{
              background: "#1e161b",
              color: "#f6efec",
              borderColor: "rgba(246,239,236,0.14)",
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  t.tone === "good" ? "#7fae8e" : t.tone === "warn" ? "#e6ac5f" : "#e4738c",
              }}
            />
            <span className="flex-1 pretty">{t.message}</span>
            {t.action ? (
              <a href={t.action.href} className="link-underline shrink-0 text-[13px] font-medium">
                {t.action.label}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
