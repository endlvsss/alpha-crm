"use client";

import { useState, type ReactNode } from "react";

/**
 * Botón de una acción que la demo no modela todavía: muestra qué haría el sistema.
 * Las acciones con efecto en los datos usan los servicios (useAction).
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
  const styles = { primary: "btn-primary", secondary: "btn-secondary", danger: "btn-danger" }[variant];
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setDone(true)}
        className={`btn ${styles}`}
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
