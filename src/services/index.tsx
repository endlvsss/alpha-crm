"use client";

// Punto de entrada de la capa de servicios para las pantallas. Elige el
// proveedor según NEXT_PUBLIC_DATA_MODE: «demo» (por defecto) usa el mock con
// datos ficticios; «api» queda reservado para el proveedor real, que todavía
// no existe porque la arquitectura de datos está por acordar.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import type { Result, Services } from "./contracts";
import { createMockServices } from "./mock/provider";
import { DemoStore } from "./mock/store";

export type { Result, Services } from "./contracts";

export const DATA_MODE: "demo" | "api" = process.env.NEXT_PUBLIC_DATA_MODE === "api" ? "api" : "demo";

interface Ctx {
  services: Services;
  ready: boolean;
  version: number;
  /** Acciones de la demo ejecutadas desde el último reinicio. */
  acciones: number;
  aviso: string | null;
  reset: () => void;
  dismissAviso: () => void;
}

const ServicesContext = createContext<Ctx | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  if (DATA_MODE === "api") {
    throw new Error("El proveedor API todavía no existe: usa NEXT_PUBLIC_DATA_MODE=demo hasta acordar los contratos.");
  }
  return <DemoServicesProvider>{children}</DemoServicesProvider>;
}

function DemoServicesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new DemoStore());
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const services = useMemo(() => createMockServices(store), [store]);
  const value = useMemo<Ctx>(
    () => ({
      services,
      ready: snap !== null,
      version: snap?.version ?? 0,
      acciones: snap?.log.length ?? 0,
      aviso: snap?.aviso ?? null,
      reset: () => store.reset(),
      dismissAviso: () => store.dismissAviso(),
    }),
    [services, snap, store],
  );
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useDemo(): Ctx {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useDemo fuera de ServicesProvider");
  return ctx;
}

/**
 * Lee datos de un servicio. `key` identifica la consulta (cambia con los filtros);
 * se vuelve a pedir cada vez que la demo cambia. `data` es undefined mientras carga.
 */
export function useQuery<T>(key: string, fn: (s: Services) => Promise<T>): { data: T | undefined; loading: boolean } {
  const { services, ready, version } = useDemo();
  const [state, setState] = useState<{ key: string; data: T } | null>(null);
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    fnRef.current(services).then((data) => {
      if (alive) setState({ key, data });
    });
    return () => {
      alive = false;
    };
  }, [services, ready, version, key]);
  const data = state && state.key === key ? state.data : undefined;
  return { data, loading: data === undefined };
}

/** Ejecuta una acción de servicio y avisa el resultado con un toast. */
export function useAction() {
  const { services } = useDemo();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const exec = useCallback(
    async <T,>(fn: (s: Services) => Promise<Result<T>>, exito?: string | ((data: T) => string)): Promise<Result<T>> => {
      setPending(true);
      try {
        const r = await fn(services);
        if (r.ok) {
          if (exito) toast.show({ tone: "ok", title: typeof exito === "function" ? exito(r.data) : exito });
        } else {
          toast.show({ tone: "danger", title: "No se pudo completar", description: r.error });
        }
        return r;
      } finally {
        setPending(false);
      }
    },
    [services, toast],
  );
  return { exec, pending };
}
