"use client";

import { useId, useState } from "react";

export interface Serie {
  key: string;
  label: string;
  /** Clase de fondo de Tailwind para la barra (usa los tokens del tema). */
  className: string;
}

export interface Punto {
  label: string;
  /** Texto largo para el tooltip y la tabla accesible. */
  detalle: string;
  values: Record<string, number>;
}

/**
 * Barras apiladas con tooltip al pasar el mouse o al enfocar con el teclado.
 * Incluye una tabla oculta con los mismos datos para lectores de pantalla.
 */
export function BarChart({
  data,
  series,
  format,
  height = 176,
  ariaLabel,
}: {
  data: Punto[];
  series: Serie[];
  format: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const id = useId();
  const [activo, setActivo] = useState<number | null>(null);
  const totales = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = Math.max(1, ...totales);
  const marcas = [max, max / 2, 0];
  const salto = data.length > 16 ? Math.ceil(data.length / 8) : 1;

  return (
    <figure className="relative" aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="sr-only">{ariaLabel}</figcaption>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${s.className}`} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-6 text-right font-mono text-[0.7rem] text-muted" style={{ height }} aria-hidden="true">
          {marcas.map((m, i) => <span key={i}>{format(Math.round(m))}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }} aria-hidden="true">
            {marcas.map((_, i) => <span key={i} className="border-t border-dashed border-line/80" />)}
          </div>
          <div className="relative flex items-end gap-1" style={{ height: height - 24 }} onMouseLeave={() => setActivo(null)}>
            {data.map((d, i) => {
              const total = totales[i];
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${d.detalle}: ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(", ")}`}
                  onMouseEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  className="group relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-md focus-visible:outline-offset-1"
                >
                  <span className={`absolute inset-0 rounded-md transition-colors ${activo === i ? "bg-ink/[0.05]" : ""}`} aria-hidden="true" />
                  <span className="relative flex flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 100}%`, minHeight: total ? 3 : 0 }}>
                    {series.map((s) => {
                      const v = d.values[s.key] ?? 0;
                      return v ? <span key={s.key} className={`${s.className} block w-full transition-opacity ${activo !== null && activo !== i ? "opacity-50" : ""}`} style={{ height: `${(v / total) * 100}%` }} /> : null;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1 font-mono text-[0.7rem] text-muted" aria-hidden="true">
            {data.map((d, i) => (
              <span key={i} className="min-w-0 flex-1 truncate text-center">{i % salto === 0 ? d.label : ""}</span>
            ))}
          </div>
          {activo !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-2 z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-float"
              style={{ left: `${((activo + 0.5) / data.length) * 100}%` }}
            >
              <p className="font-semibold">{data[activo].detalle}</p>
              {series.map((s) => (
                <p key={s.key} className="mt-0.5 flex items-center justify-between gap-3">
                  <span className="opacity-80">{s.label}</span>
                  <span className="font-mono tabular-nums">{format(data[activo].values[s.key] ?? 0)}</span>
                </p>
              ))}
              {series.length > 1 && (
                <p className="mt-1 flex justify-between gap-3 border-t border-bg/20 pt-1 font-semibold">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{format(totales[activo])}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="sr-only">
      <table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            {series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.detalle}</th>
              {series.map((s) => <td key={s.key}>{format(d.values[s.key] ?? 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/** «$1,2 M», «$480 mil»: montos compactos para ejes. */
export function clpCompacto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)} mil`;
  return `$${n}`;
}
