import type {
  CausaFalla,
  Dispositivo,
  EstadoTecnico,
  Pago,
  EstadoCliente,
  EstadoOrden,
  EstadoSuscripcion,
  EstadoTicket,
  EstadoVisita,
  Origen,
  OrigenTicket,
  TipoVisita,
} from "./types";

export type Tone = "accent" | "amber" | "ok" | "danger" | "muted" | "brand";

export const ESTADO_CLIENTE_TONE: Record<EstadoCliente, Tone> = {
  LEAD: "muted",
  PAGADO: "brand",
  "INSTALACIÓN AGENDADA": "amber",
  ACTIVO: "ok",
  SUSPENDIDO: "danger",
  CANCELADO: "muted",
};

export const ESTADO_CLIENTE_AYUDA: Record<EstadoCliente, string> = {
  LEAD: "Llegó a la landing o empezó a comprar",
  PAGADO: "Pagó; falta agendar la instalación",
  "INSTALACIÓN AGENDADA": "Tiene técnico y horario",
  ACTIVO: "Vehículo instalado y reportando",
  SUSPENDIDO: "Sin pago tras el período de gracia",
  CANCELADO: "Dejó el servicio",
};

export const ORIGEN_LABEL: Record<Origen, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok",
  organico: "Orgánico",
  referido: "Referido",
  whatsapp: "WhatsApp",
};

export const ESTADO_ORDEN: Record<EstadoOrden, { label: string; tone: Tone }> = {
  checkout_iniciado: { label: "Checkout iniciado", tone: "muted" },
  pendiente_pago: { label: "Pendiente de pago", tone: "amber" },
  abandonada: { label: "Abandonada", tone: "amber" },
  pago_rechazado: { label: "Pago rechazado", tone: "danger" },
  pagada: { label: "Pagada", tone: "ok" },
  cancelada: { label: "Cancelada", tone: "muted" },
  reembolsada: { label: "Reembolsada", tone: "muted" },
};

export const ESTADO_VISITA: Record<EstadoVisita, { label: string; tone: Tone }> = {
  por_agendar: { label: "Por agendar", tone: "brand" },
  lista_espera: { label: "Lista de espera", tone: "amber" },
  requiere_persona: { label: "Requiere persona", tone: "danger" },
  agendada: { label: "Por confirmar", tone: "amber" },
  confirmada: { label: "Confirmada", tone: "accent" },
  en_camino: { label: "En camino", tone: "accent" },
  en_sitio: { label: "En el lugar", tone: "accent" },
  en_instalacion: { label: "Instalando", tone: "accent" },
  en_pruebas: { label: "En pruebas", tone: "accent" },
  cerrada_ok: { label: "Cerrada", tone: "ok" },
  fallida: { label: "Con incidencia", tone: "danger" },
  no_show_cliente: { label: "Cliente no estaba", tone: "muted" },
  tecnico_no_disponible: { label: "Reasignar", tone: "danger" },
  cancelada: { label: "Cancelada", tone: "muted" },
};

export const TIPO_VISITA: Record<TipoVisita, string> = {
  instalacion: "Instalación",
  segunda_visita: "Segunda visita",
  visita_tecnica: "Visita técnica",
  traslado: "Traslado",
};

export const CAUSA_FALLA: Record<CausaFalla, string> = {
  electrico: "Eléctrico del vehículo",
  incompatibilidad: "Incompatibilidad",
  falla_gps: "Falla del GPS",
  senal: "Señal",
  plataforma: "Plataforma",
  falta_componente: "Falta de componente",
  otro: "Otro",
};

export const ESTADO_TICKET_TONE: Record<EstadoTicket, Tone> = {
  ABIERTO: "danger",
  "EN REVISIÓN": "amber",
  "ESPERANDO CLIENTE": "muted",
  "VISITA TÉCNICA": "accent",
  RESUELTO: "ok",
};

export const ORIGEN_TICKET: Record<OrigenTicket, string> = {
  bot: "Bot de soporte",
  gps_offline: "GPS sin reportar",
  desacople: "Desacople de señales",
  instalacion: "Instalación fallida",
  cancelacion: "Cancelación",
  traslado: "Traslado",
};

export const ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, { label: string; tone: Tone }> = {
  pendiente_instalacion: { label: "Pendiente de instalación", tone: "brand" },
  activa: { label: "Activa", tone: "ok" },
  pago_pendiente: { label: "Pago pendiente", tone: "amber" },
  suspendida: { label: "Suspendida", tone: "danger" },
  cancelada: { label: "Cancelada", tone: "muted" },
};

/** Estados de una visita que aún ocupan al técnico. */
export const VISITA_ACTIVA: EstadoVisita[] = [
  "agendada",
  "confirmada",
  "en_camino",
  "en_sitio",
  "en_instalacion",
  "en_pruebas",
];

/**
 * Grupos de estado de una instalación para Operaciones. Agrupan los estados
 * internos de la visita (sección 6.2 de la especificación) en 7 lecturas simples.
 */
export type GrupoVisita = "pendiente" | "asignada" | "en_camino" | "en_proceso" | "completada" | "cancelada" | "revision";

export const GRUPO_VISITA: Record<GrupoVisita, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "brand" },
  asignada: { label: "Asignada", tone: "amber" },
  en_camino: { label: "En camino", tone: "accent" },
  en_proceso: { label: "En proceso", tone: "accent" },
  completada: { label: "Completada", tone: "ok" },
  cancelada: { label: "Cancelada", tone: "muted" },
  revision: { label: "Requiere revisión", tone: "danger" },
};

export function grupoVisita(estado: EstadoVisita): GrupoVisita {
  switch (estado) {
    case "por_agendar":
    case "lista_espera":
      return "pendiente";
    case "agendada":
    case "confirmada":
      return "asignada";
    case "en_camino":
      return "en_camino";
    case "en_sitio":
    case "en_instalacion":
    case "en_pruebas":
      return "en_proceso";
    case "cerrada_ok":
      return "completada";
    case "cancelada":
      return "cancelada";
    default:
      return "revision";
  }
}

export const ESTADO_TECNICO: Record<EstadoTecnico, { label: string; tone: Tone }> = {
  postulante: { label: "Postulante", tone: "muted" },
  en_validacion: { label: "En validación", tone: "amber" },
  activo: { label: "Activo", tone: "ok" },
  suspendido: { label: "Suspendido", tone: "danger" },
  baja: { label: "Baja", tone: "muted" },
};

export const DOCUMENTO_TECNICO: Record<string, string> = {
  cedula: "Cédula de identidad",
  antecedentes: "Certificado de antecedentes",
  licencia: "Licencia de conducir",
  certificacion: "Certificación eléctrica automotriz",
};

export const ESTADO_PAGO: Record<Pago["estado"], { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  aprobado: { label: "Confirmado", tone: "ok" },
  rechazado: { label: "Rechazado", tone: "danger" },
  reembolsado: { label: "Reembolsado", tone: "muted" },
};

export const ESTADO_DISPOSITIVO: Record<Dispositivo["estado"], { label: string; tone: Tone }> = {
  en_stock: { label: "En bodega", tone: "muted" },
  asignado: { label: "En custodia", tone: "brand" },
  instalado: { label: "Instalado · por activar", tone: "amber" },
  activo: { label: "Activo", tone: "ok" },
  falla: { label: "Con falla", tone: "danger" },
  retirado: { label: "Retirado", tone: "muted" },
};

export const NIVEL_TONE: Record<"INFO" | "ATENCIÓN" | "URGENTE", Tone> = {
  INFO: "muted",
  ATENCIÓN: "amber",
  URGENTE: "danger",
};
