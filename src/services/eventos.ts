// Eventos de integración entre el sitio, el portal del técnico y el CRM.
// DEMO: viajan en el fragmento de la URL (#evento=…), que no llega a ningún
// servidor, y quien los recibe los muestra y los aplica con un clic. En
// producción serán webhooks firmados con la misma forma (ver docs/contratos-api.md).
//
// Este archivo es idéntico en ambos repositorios (alpha-crm/src/services/eventos.ts
// y website/src/lib/eventos.ts): si cambia uno, se copia al otro.

export const EVENTO_VERSION = 1;

export type PlanEvento = "esencial" | "seguridad" | "flota";
export type PeriodicidadEvento = "mensual" | "anual";
export type CausaEvento = "electrico" | "incompatibilidad" | "falla_gps" | "senal" | "plataforma" | "falta_componente" | "otro";

export interface DireccionEvento {
  calle: string;
  detalle: string;
  comuna: string;
  indicaciones: string;
}

export interface VehiculoEvento {
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
}

/** Sitio → CRM: compra del checkout (y reserva, si el cliente ya eligió horario). */
export interface CompraSitio {
  cliente: { nombre: string; rut: string; email: string; telefono: string };
  direccion: DireccionEvento;
  vehiculos: VehiculoEvento[];
  plan: PlanEvento;
  periodicidad: PeriodicidadEvento;
  consentimientoMarketing: boolean;
  orden: { folio: string; total: number; estado: "pendiente" | "pagada" | "rechazada"; pagadaEn: string | null } | null;
  /** tecnicoRut: técnico que ofreció el bloque (null si la disponibilidad era ficticia). */
  reserva: { folio: string; fecha: string; bloque: string; tecnicoRut: string | null } | null;
  listaEspera: boolean;
}

/** Portal del técnico → CRM: resultado de una visita. La patente identifica el vehículo. */
export interface ResultadoVisita {
  folioPortal: string;
  patente: string;
  tecnicoRut: string;
  resultado: "cerrada_ok" | "fallida";
  imeiGps: string | null;
  checklistOk: number;
  checklistTotal: number;
  fotos: number;
  firma: boolean;
  causa: CausaEvento | null;
  descripcion: string | null;
  cerradaEn: string;
}

/** CRM → portal del técnico: visita asignada por Operaciones. */
export interface VisitaAsignada {
  folio: string;
  tipo: "instalacion" | "segunda_visita" | "visita_tecnica" | "traslado";
  fecha: string;
  bloque: string;
  fin: string;
  cliente: { nombre: string; telefono: string };
  direccion: DireccionEvento;
  vehiculo: VehiculoEvento & { color: string };
  plan: PlanEvento;
  tecnicoRut: string;
  notas: string;
}

interface Base<T extends string, D> {
  v: typeof EVENTO_VERSION;
  id: string;
  tipo: T;
  emitidoEn: string;
  datos: D;
}

export type Evento =
  | Base<"sitio.compra", CompraSitio>
  | Base<"portal.visita", ResultadoVisita>
  | Base<"crm.visita", VisitaAsignada>;

export type TipoEvento = Evento["tipo"];

export function nuevoEvento<T extends TipoEvento>(tipo: T, datos: Extract<Evento, { tipo: T }>["datos"]): Extract<Evento, { tipo: T }> {
  const id = `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { v: EVENTO_VERSION, id, tipo, emitidoEn: new Date().toISOString(), datos } as Extract<Evento, { tipo: T }>;
}

/** JSON → base64url (UTF-8), para el fragmento de la URL. */
export function codificarEvento(evento: Evento): string {
  const bytes = new TextEncoder().encode(JSON.stringify(evento));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodificarEvento(texto: string): { ok: true; evento: Evento } | { ok: false; error: string } {
  try {
    const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const ev = JSON.parse(json) as Partial<Evento>;
    if (ev.v !== EVENTO_VERSION) return { ok: false, error: `Versión de evento no soportada (${String(ev.v)})` };
    if (!ev.id || !ev.tipo || !ev.datos || !["sitio.compra", "portal.visita", "crm.visita"].includes(ev.tipo)) {
      return { ok: false, error: "El evento no tiene la forma esperada" };
    }
    return { ok: true, evento: ev as Evento };
  } catch {
    return { ok: false, error: "No se pudo leer el evento (enlace incompleto o dañado)" };
  }
}

/** Lee #evento=… de la URL actual. */
export function eventoDesdeHash(hash: string) {
  const m = /(?:^#|&)evento=([^&]+)/.exec(hash);
  return m ? decodificarEvento(m[1]) : null;
}

export function enlaceEvento(base: string, ruta: string, evento: Evento): string {
  return `${base.replace(/\/$/, "")}${ruta}#evento=${codificarEvento(evento)}`;
}

/** Direcciones de cada sistema en la demo (se cambian con variables de entorno). */
export const URL_SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const URL_CRM = process.env.NEXT_PUBLIC_CRM_URL ?? "http://localhost:3200";
/** El portal de demo tiene un solo técnico; su RUT es el identificador compartido. */
export const RUT_TECNICO_PORTAL = "15.678.901-1";
