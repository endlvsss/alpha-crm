// Estado de la demo: la semilla determinista del día + el registro de comandos
// que ejecutó la persona. Al recargar se reproduce el registro sobre la semilla,
// así que el navegador solo guarda la lista de comandos.
//
// Aislamiento del modo productivo: este módulo solo lo usa el proveedor mock.
// La clave de almacenamiento lleva el prefijo «demo» y nunca contiene datos reales.

import { buildDb, santiagoToday, type Db } from "@/data/seed";
import { aplicar, ReglaError, type Comando } from "@/lib/domain/engine";

export const DEMO_STORAGE_KEY = "alg-crm:demo:v1";

interface Persistido {
  hoy: string;
  log: Comando[];
}

export interface DemoSnapshot {
  db: Db;
  log: Comando[];
  version: number;
  /** Aviso al cargar (por ejemplo, la demo se reinició porque cambió el día). */
  aviso: string | null;
}

type Listener = () => void;

export class DemoStore {
  private snap: DemoSnapshot | null = null;
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): DemoSnapshot => {
    if (!this.snap) this.snap = this.cargar();
    return this.snap;
  };

  getServerSnapshot = (): DemoSnapshot | null => null;

  /** Aplica un comando. Devuelve el mensaje de error si una regla lo impide. */
  dispatch(cmd: Comando): string | null {
    const actual = this.getSnapshot();
    const db = structuredClone(actual.db);
    try {
      aplicar(db, cmd);
    } catch (e) {
      if (e instanceof ReglaError) return e.message;
      throw e;
    }
    this.set({ db, log: [...actual.log, cmd], version: actual.version + 1, aviso: null });
    return null;
  }

  reset() {
    this.set({ db: buildDb(santiagoToday()), log: [], version: (this.snap?.version ?? 0) + 1, aviso: null });
  }

  dismissAviso() {
    if (this.snap?.aviso) this.set({ ...this.snap, aviso: null });
  }

  private set(next: DemoSnapshot) {
    this.snap = next;
    guardar({ hoy: next.db.hoy, log: next.log });
    this.listeners.forEach((fn) => fn());
  }

  private cargar(): DemoSnapshot {
    const hoy = santiagoToday();
    const db = buildDb(hoy);
    const guardado = leer();
    if (!guardado || guardado.log.length === 0) return { db, log: [], version: 1, aviso: null };
    if (guardado.hoy !== hoy) {
      // Los datos semilla dependen de la fecha: un registro de otro día ya no cuadra.
      guardar({ hoy, log: [] });
      return { db, log: [], version: 1, aviso: "La demo se reinició porque cambió el día: los datos semilla se generan con la fecha de hoy." };
    }
    const log: Comando[] = [];
    for (const cmd of guardado.log) {
      try {
        aplicar(db, cmd);
        log.push(cmd);
      } catch {
        // Un comando que ya no aplica se descarta en silencio.
      }
    }
    return { db, log, version: 1, aviso: null };
  }
}

function leer(): Persistido | null {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persistido;
    return Array.isArray(data.log) && typeof data.hoy === "string" ? data : null;
  } catch {
    return null;
  }
}

function guardar(data: Persistido) {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Sin almacenamiento (modo privado): la demo funciona igual, sin persistir.
  }
}
