"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

export const THEME_STORAGE_KEY = "alg-theme-v2";

export type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Tema activo. En el servidor y al hidratar vale "dark", el tema principal. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const isDark = useTheme() === "dark";

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: el cambio dura hasta recargar.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!isDark}
      aria-label="Modo claro"
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`relative inline-flex size-10 items-center justify-center rounded-xl text-ink-soft transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink ${className}`}
    >
      {/* Los íconos dependen de CSS, no del estado: no parpadean al cargar. */}
      <MoonIcon className="size-[1.1rem] dark:hidden" />
      <SunIcon className="hidden size-[1.15rem] dark:block" />
    </button>
  );
}
