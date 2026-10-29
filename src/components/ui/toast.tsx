"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, CloseIcon, InfoIcon, AlertIcon } from "./icons";

type ToastTone = "ok" | "danger" | "info";

interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (t: ToastInput) => void } | null>(null);

const ICON = { ok: CheckIcon, danger: AlertIcon, info: InfoIcon };
const TONE = {
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  info: "bg-accent-soft text-accent-ink",
};

/** Avisos breves de resultado. Se anuncian a lectores de pantalla (aria-live). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "danger" ? 7000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {items.map((t) => {
          const tone = t.tone ?? "info";
          const Icon = ICON[tone];
          return (
            <div
              key={t.id}
              role={tone === "danger" ? "alert" : "status"}
              className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface p-3.5 shadow-float ring-1 ring-line"
            >
              <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ${TONE[tone]}`}>
                <Icon className="size-3.5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
              >
                <CloseIcon className="size-4" />
                <span className="sr-only">Cerrar aviso</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}
