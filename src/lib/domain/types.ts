// Modelo de datos del CRM de Alpha Link GPS. Sigue la especificación del módulo
// de instaladores v0.2 (sección 5) y el Service Blueprint B2C v2. Cada interfaz
// corresponde a una tabla; los nombres pasan tal cual a las migraciones SQL.

import type { IsoDate } from "@/lib/format";
import type { Billing, PlanId } from "@/lib/plans";

/** Instante ISO 8601 (timestamptz). */
export type Iso = string;

// ——— Estado del cliente (blueprint, sección 6.1) ———

export const ESTADOS_CLIENTE = [
  "LEAD",
  "PAGADO",
  "INSTALACIÓN AGENDADA",
  "ACTIVO",
  "SUSPENDIDO",
  "CANCELADO",
] as const;
export type EstadoCliente = (typeof ESTADOS_CLIENTE)[number];

export type SubestadoCliente =
  | "INTERESADO"
  | "CHECKOUT INICIADO"
  | "CHECKOUT ABANDONADO"
  | "TÉCNICO EN CAMINO"
  | "EN INSTALACIÓN"
  | "INCIDENCIA INSTALACIÓN"
  | "SOPORTE ABIERTO"
  | "PAGO PENDIENTE";

export type Origen = "meta" | "google" | "tiktok" | "organico" | "referido" | "whatsapp";

export interface Cliente {
  id: string;
  nombre: string;
  rut: string;
  email: string;
  telefono: string;
  comuna: string;
  direccion: string;
  estado: EstadoCliente;
  subestado: SubestadoCliente | null;
  origen: Origen;
  campana: string | null;
  consentimientoMarketing: boolean;
  creadoEn: Iso;
  /** Evento CUENTA CREADA: el pago se aprobó y existe la cuenta en la plataforma. */
  cuentaCreadaEn: Iso | null;
  /** Evento INSTALADO del primer vehículo. */
  instaladoEn: Iso | null;
  motivoBaja: string | null;
}

export interface Vehiculo {
  id: string;
  clienteId: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  estado: "pendiente" | "activo" | "baja";
  imeiGps: string | null;
  imeiTag: string | null;
}

// ——— Venta (sección 6.3) ———

export type EstadoOrden =
  | "checkout_iniciado"
  | "abandonada"
  | "pago_rechazado"
  | "pagada"
  | "cancelada"
  | "reembolsada";

export interface Orden {
  folio: string;
  clienteId: string;
  planId: PlanId;
  periodicidad: Billing;
  vehiculos: number;
  estado: EstadoOrden;
  montoTotal: number;
  pasarela: "webpay";
  pagoRef: string | null;
  creadaEn: Iso;
  pagadaEn: Iso | null;
}

// ——— Suscripción y cobro (sección 6.4, tramo 4) ———

export type EstadoSuscripcion =
  | "pendiente_instalacion"
  | "activa"
  | "pago_pendiente"
  | "suspendida"
  | "cancelada";

export interface Suscripcion {
  id: string;
  clienteId: string;
  vehiculoId: string;
  planId: PlanId;
  periodicidad: Billing;
  estado: EstadoSuscripcion;
  montoPeriodo: number;
  inicio: IsoDate | null;
  proximoCobro: IsoDate | null;
  /** Primer cobro fallido sin regularizar: inicia el período de gracia. */
  morosoDesde: IsoDate | null;
}

export interface Cobro {
  id: string;
  suscripcionId: string;
  clienteId: string;
  fecha: IsoDate;
  monto: number;
  estado: "aprobado" | "rechazado";
  intento: number;
}

// ——— Instaladores y agenda (secciones 5 y 7) ———

export interface Tecnico {
  id: string;
  nombre: string;
  rut: string;
  telefono: string;
  email: string;
  comunas: string[];
  estado: "postulante" | "en_validacion" | "activo" | "suspendido" | "baja";
  cupoDiario: number;
  validadoEn: IsoDate | null;
}

export type TipoVisita = "instalacion" | "segunda_visita" | "visita_tecnica" | "traslado";

/** Estado interno de la visita (sección 6.2). */
export type EstadoVisita =
  | "por_agendar"
  | "lista_espera"
  | "requiere_persona"
  | "agendada"
  | "confirmada"
  | "en_camino"
  | "en_sitio"
  | "en_instalacion"
  | "en_pruebas"
  | "cerrada_ok"
  | "fallida"
  | "no_show_cliente"
  | "tecnico_no_disponible"
  | "cancelada";

export type CausaFalla =
  | "electrico"
  | "incompatibilidad"
  | "falla_gps"
  | "senal"
  | "plataforma"
  | "falta_componente"
  | "otro";

export interface Visita {
  folio: string;
  tipo: TipoVisita;
  clienteId: string;
  vehiculoId: string;
  ordenFolio: string | null;
  ticketFolio: string | null;
  tecnicoId: string | null;
  comuna: string;
  fecha: IsoDate | null;
  bloque: string | null;
  estado: EstadoVisita;
  causaFalla: CausaFalla | null;
  reprogramaciones: number;
  imei: string | null;
  checkInEn: Iso | null;
  checkOutEn: Iso | null;
  creadaEn: Iso;
}

export interface Dispositivo {
  imei: string;
  modelo: "VL103M" | "PB705";
  tipo: "gps" | "tag";
  simIccid: string | null;
  estado: "en_stock" | "asignado" | "instalado" | "activo" | "falla" | "retirado";
  custodiaTecnicoId: string | null;
  vehiculoId: string | null;
  /** Último pulso recibido de la plataforma GPS (simulado). */
  ultimoPulso: Iso | null;
  bateria: number | null;
}

// ——— Soporte (tramos 3 y 3B) ———

export type EstadoTicket = "ABIERTO" | "EN REVISIÓN" | "ESPERANDO CLIENTE" | "VISITA TÉCNICA" | "RESUELTO";
export type OrigenTicket = "bot" | "gps_offline" | "desacople" | "instalacion" | "cancelacion" | "traslado";
export type Nivel = "INFO" | "ATENCIÓN" | "URGENTE";

export interface Ticket {
  folio: string;
  clienteId: string;
  vehiculoId: string | null;
  origen: OrigenTicket;
  nivel: Nivel;
  estado: EstadoTicket;
  asunto: string;
  detalle: string;
  visitaFolio: string | null;
  creadoEn: Iso;
  resueltoEn: Iso | null;
}

// ——— Plataforma GPS (GPSTracker): espejo simulado de la cuenta del cliente ———

export interface CuentaPlataforma {
  clienteId: string;
  /** Usuario «Cliente» en GPSTracker: pendiente hasta que acepta la invitación. */
  estadoUsuario: "pendiente" | "activo" | "bloqueado";
  invitadoEn: Iso;
  ultimoIngreso: Iso | null;
}

export interface AlertaPlataforma {
  id: string;
  clienteId: string;
  vehiculoId: string;
  tipo: string;
  severidad: "critica" | "alta" | "media" | "baja";
  en: Iso;
  resuelta: boolean;
}

// ——— Bitácora inmutable (tabla eventos) ———

export interface Evento {
  id: string;
  clienteId: string;
  entidad: "cliente" | "orden" | "visita" | "suscripcion" | "ticket" | "plataforma";
  entidadRef: string;
  tipo: string;
  detalle: string | null;
  actor: "sistema" | "cliente" | "tecnico" | "operaciones";
  en: Iso;
}
