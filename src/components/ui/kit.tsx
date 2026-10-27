import Link from "next/link";
import type { ReactNode } from "react";
import type { EstadoCliente } from "@/lib/domain/types";
import { ESTADO_CLIENTE_TONE, type Tone } from "@/lib/domain/labels";

// Piezas visuales del CRM. Superficies separadas por tono, sin sombras en reposo
// (mismo criterio que el sitio de Alpha Link GPS), densas para trabajar.

const toneClass: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-ink",
  brand: "bg-brand/12 text-brand",
  amber: "bg-amber-soft text-amber",
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  muted: "bg-ink/[0.07] text-ink-soft",
};

const dotClass: Record<Tone, string> = {
  accent: "bg-accent",
  brand: "bg-brand",
  amber: "bg-amber-bright",
  ok: "bg-ok",
  danger: "bg-danger",
  muted: "bg-muted",
};

export function Pill({ tone, children, dot = false }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${toneClass[tone]}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dotClass[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${dotClass[tone]}`} aria-hidden="true" />;
}

/** Estado del cliente (taxonomía del blueprint) con su subestado. */
export function EstadoPill({ estado, subestado }: { estado: EstadoCliente; subestado?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Pill tone={ESTADO_CLIENTE_TONE[estado]} dot>
        {estado}
      </Pill>
      {subestado && (
        <span className="font-mono text-[0.75rem] font-medium tracking-wide text-muted uppercase">{subestado}</span>
      )}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 font-mono text-xs font-medium tracking-[0.14em] text-accent-ink uppercase">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-2xl bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
          {title && <h2 className="font-display text-[0.95rem] font-bold tracking-[-0.01em] text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? "p-5 pt-3" : "pb-2"}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-[-0.02em] tabular-nums ${tone ? toneText[tone] : "text-ink"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl bg-surface p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-surface-2`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const toneText: Record<Tone, string> = {
  accent: "text-accent-ink",
  brand: "text-brand",
  amber: "text-amber",
  ok: "text-ok",
  danger: "text-danger",
  muted: "text-muted",
};

/** Pestañas como enlaces: cada una es una URL que se puede compartir. */
export function Tabs({ items, current }: { items: { key: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Secciones" className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ink text-bg" : "text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-md px-1.5 font-mono text-xs ${active ? "bg-bg/20" : "bg-ink/[0.07]"}`}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Table({ head, children, minWidth = 720 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-xs font-medium text-muted">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 pt-3.5 pb-2.5 font-medium whitespace-nowrap first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-line/70 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-bg-sunken/60 px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-deep font-display text-xs font-bold text-on-deep ${className}`}
    >
      {initials}
    </span>
  );
}

/** Lista de datos etiqueta → valor. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 truncate text-sm text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[0.8125rem] ${className}`}>{children}</span>;
}

export function Patente({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-md border border-line-strong bg-surface-2 px-1.5 py-px font-mono text-xs font-medium tracking-wider text-ink">
      {children}
    </span>
  );
}

/** Nota para todo lo que es simulado o está por definir. */
export function SimTag({ children = "Simulado" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold tracking-wide text-amber uppercase">
      <span className="size-1.5 rounded-full bg-amber-bright" aria-hidden="true" />
      {children}
    </span>
  );
}
