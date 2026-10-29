"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

// Diálogos y paneles laterales sobre <dialog> nativo: foco atrapado, Esc para
// cerrar y devolución del foco al elemento que lo abrió, sin dependencias.

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = () => onCloseRef.current();
    d.addEventListener("close", handle);
    return () => d.removeEventListener("close", handle);
  }, []);
  return ref;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
    >
      <CloseIcon className="size-5" />
      <span className="sr-only">Cerrar</span>
    </button>
  );
}

/** Panel lateral derecho para ver el detalle sin perder el contexto de la lista. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useNativeDialog(open, onClose);
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`sheet m-0 ml-auto h-dvh max-h-dvh w-full ${width} bg-surface p-0 text-ink shadow-float`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-line/70 px-5 pt-4 pb-3">
            <div className="min-w-0">
              {eyebrow && <div className="mb-0.5 font-mono text-xs font-medium tracking-[0.14em] text-accent-ink uppercase">{eyebrow}</div>}
              <h2 id={id} className="font-display text-lg font-bold tracking-[-0.015em]">
                {title}
              </h2>
            </div>
            <CloseButton onClick={onClose} />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/70 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Diálogo centrado para formularios y confirmaciones. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useNativeDialog(open, onClose);
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`modal m-auto max-h-[min(92dvh,48rem)] w-[calc(100%-2rem)] ${width} rounded-2xl bg-surface p-0 text-ink shadow-float`}
    >
      {open && (
        <div className="flex max-h-[min(92dvh,48rem)] flex-col">
          <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="min-w-0">
              <h2 id={id} className="font-display text-lg font-bold tracking-[-0.015em]">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <CloseButton onClick={onClose} />
          </header>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>}
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 px-5 pt-2 pb-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmación de una acción con consecuencias (reembolso, baja, suspensión). */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = false,
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={`btn ${danger ? "btn-danger" : "btn-primary"}`}>
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
