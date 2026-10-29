// Pipeline comercial de Alpha Link GPS: 8 etapas que se calculan a partir de la
// orden, el pago, las visitas y la activación. Nadie mueve una tarjeta a mano:
// avanzar de etapa es ejecutar el evento del sistema que corresponde (D7).

import type { Cliente, Orden, Visita } from "./types";
import { VISITA_ACTIVA, type Tone } from "./labels";

export const ETAPAS = [
  "nuevo_lead",
  "checkout_iniciado",
  "pendiente_pago",
  "pago_confirmado",
  "instalacion_pendiente",
  "instalacion_agendada",
  "instalado",
  "activo",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA: Record<Etapa, { label: string; ayuda: string; tone: Tone }> = {
  nuevo_lead: { label: "Nuevo lead", ayuda: "Llegó desde la landing o una campaña", tone: "muted" },
  checkout_iniciado: { label: "Checkout iniciado", ayuda: "Eligió plan; aún no va a pagar", tone: "muted" },
  pendiente_pago: { label: "Pendiente de pago", ayuda: "En la pasarela o con pago rechazado", tone: "amber" },
  pago_confirmado: { label: "Pago confirmado", ayuda: "Pagó; falta crear la orden de instalación", tone: "brand" },
  instalacion_pendiente: { label: "Instalación pendiente", ayuda: "Orden creada; falta día, bloque y técnico", tone: "brand" },
  instalacion_agendada: { label: "Instalación agendada", ayuda: "Tiene técnico y bloque", tone: "amber" },
  instalado: { label: "Instalado", ayuda: "Instalación física lista; falta activar", tone: "accent" },
  activo: { label: "Activo", ayuda: "Servicio activado y reportando", tone: "ok" },
};

/** Qué evento del sistema mueve un caso a la etapa siguiente. */
export const AVANCE: Record<Exclude<Etapa, "activo">, { accion: string; requiere: "plan" | "reserva" | "instalacion" | null }> = {
  nuevo_lead: { accion: "Iniciar checkout", requiere: "plan" },
  checkout_iniciado: { accion: "Enviar a la pasarela", requiere: null },
  pendiente_pago: { accion: "Simular pago aprobado", requiere: null },
  pago_confirmado: { accion: "Crear orden de instalación", requiere: null },
  instalacion_pendiente: { accion: "Reservar bloque y técnico", requiere: "reserva" },
  instalacion_agendada: { accion: "Simular instalación completa", requiere: "instalacion" },
  instalado: { accion: "Confirmar activación", requiere: null },
};

const SIGUIENTE_ACCION: Record<Etapa, string> = {
  nuevo_lead: "Contactar y presentar planes",
  checkout_iniciado: "Recordar el pago pendiente",
  pendiente_pago: "Esperar respuesta de la pasarela",
  pago_confirmado: "Crear la orden de instalación",
  instalacion_pendiente: "Agendar día, bloque y técnico",
  instalacion_agendada: "Confirmar asistencia del técnico",
  instalado: "Verificar pulso y activar",
  activo: "Seguimiento postventa",
};

const EN_AGENDA = new Set<Visita["estado"]>([...VISITA_ACTIVA, "fallida"]);
const SIN_AGENDA = new Set<Visita["estado"]>(["por_agendar", "lista_espera", "requiere_persona"]);

/** Etapa comercial del cliente; null si quedó fuera del embudo (suspendido o cancelado). */
export function etapaDe(cliente: Cliente, orden: Orden | null, visitas: Visita[]): Etapa | null {
  if (cliente.estado === "SUSPENDIDO" || cliente.estado === "CANCELADO") return null;
  if (cliente.activadoEn) return "activo";
  if (cliente.instaladoEn) return "instalado";
  const instalacion = visitas.filter((v) => v.tipo === "instalacion" || v.tipo === "segunda_visita");
  if (instalacion.some((v) => EN_AGENDA.has(v.estado))) return "instalacion_agendada";
  if (instalacion.some((v) => SIN_AGENDA.has(v.estado))) return "instalacion_pendiente";
  if (!orden) return "nuevo_lead";
  if (orden.estado === "pagada") return "pago_confirmado";
  if (orden.estado === "pendiente_pago" || orden.estado === "pago_rechazado") return "pendiente_pago";
  if (orden.estado === "checkout_iniciado" || orden.estado === "abandonada") return "checkout_iniciado";
  return "nuevo_lead";
}

export function siguienteAccion(etapa: Etapa, cliente: Cliente, orden: Orden | null): string {
  if (etapa === "checkout_iniciado" && orden?.estado === "abandonada") {
    return cliente.consentimientoMarketing ? "Recuperar checkout abandonado" : "Sin consentimiento: no contactar";
  }
  if (etapa === "pendiente_pago" && orden?.estado === "pago_rechazado") return "Invitar a reintentar el pago";
  if (cliente.subestado === "INCIDENCIA INSTALACIÓN") return "Coordinar segunda visita";
  return SIGUIENTE_ACCION[etapa];
}

export function etapaSiguiente(etapa: Etapa): Etapa | null {
  const i = ETAPAS.indexOf(etapa);
  return i < ETAPAS.length - 1 ? ETAPAS[i + 1] : null;
}
