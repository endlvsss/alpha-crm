"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoHorizontal } from "@/components/brand/logo";
import { CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { NAV } from "./nav";
import { ThemeToggle } from "./theme-toggle";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-5">
      {NAV.map((group, i) => (
        <div key={i}>
          {group.title && (
            <p className="mb-1.5 px-3 font-mono text-[0.75rem] font-medium tracking-[0.14em] text-muted uppercase">
              {group.title}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
                    }`}
                  >
                    <Icon className="size-[1.1rem] shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Search({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <form action="/clientes" role="search" onSubmit={onNavigate} className="relative">
      <label htmlFor="buscar" className="sr-only">
        Buscar cliente
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        id="buscar"
        name="q"
        type="search"
        placeholder="Nombre, RUT o patente"
        className="h-9 w-full rounded-xl bg-bg-sunken pr-3 pl-9 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-ring"
      />
    </form>
  );
}

function Footer() {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-bg-sunken/70 p-2 pl-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">Operaciones</p>
        <p className="truncate text-xs text-muted">Demo · datos ficticios</p>
      </div>
      <ThemeToggle className="shrink-0" />
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 overflow-y-auto bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-2 px-3 text-ink">
          <LogoHorizontal className="h-7 w-auto" />
          <span className="rounded-md bg-ink/[0.07] px-1.5 py-0.5 font-mono text-[0.7rem] font-medium tracking-wider text-muted">
            CRM
          </span>
        </Link>
        <Search />
        <Links />
        <div className="mt-auto">
          <Footer />
        </div>
      </aside>

      {/* Celular y tablet */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <LogoHorizontal className="h-6 w-auto" />
          <span className="font-mono text-[0.7rem] text-muted">CRM</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="menu-movil"
          className="inline-flex size-10 items-center justify-center rounded-xl text-ink hover:bg-ink/[0.06]"
        >
          <MenuIcon className="size-5" />
          <span className="sr-only">Abrir menú</span>
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" aria-label="Cerrar menú" onClick={close} className="absolute inset-0 bg-black/50" />
          <div id="menu-movil" className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-5 overflow-y-auto bg-surface px-3 py-4">
            <div className="flex items-center justify-between px-3">
              <LogoHorizontal className="h-6 w-auto text-ink" />
              <button type="button" onClick={close} className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-ink/[0.06]">
                <CloseIcon className="size-5" />
                <span className="sr-only">Cerrar menú</span>
              </button>
            </div>
            <Search onNavigate={close} />
            <Links onNavigate={close} />
            <div className="mt-auto">
              <Footer />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
