"use client";

import { useState, type ReactNode } from "react";

/**
 * Botón de una acción que en el mockup no persiste: muestra qué haría el sistema.
 * Con la base de datos lista se reemplaza por una Server Action.
 */
export function DemoAction({
  children,
  result,
  variant = "secondary",
}: {
  children: ReactNode;
  /** Qué pasaría al ejecutarla, en una frase. */
  result: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [done, setDone] = useState(false);
  const styles = {
    primary: "bg-brand text-on-brand hover:bg-brand-strong",
    secondary: "bg-ink/[0.07] text-ink hover:bg-ink/[0.11]",
    danger: "bg-danger-soft text-danger hover:bg-danger/20",
  }[variant];
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setDone(true)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${styles}`}
      >
        {children}
      </button>
      {done && (
        <span role="status" className="max-w-64 text-xs text-muted">
          Simulado: {result}
        </span>
      )}
    </span>
  );
}
