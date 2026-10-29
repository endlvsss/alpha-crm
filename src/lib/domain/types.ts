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

/** Persona del equipo interno de Alpha Link (ficticia en la demo). */
export interface Usuario {
  id: string;
  nombre: string;
  rol: "ventas" | "operaciones" | "soporte" | "finanzas";
}

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
  /** Evento INSTALADO del primer vehículo (instalación física terminada). */
  instaladoEn: Iso | null;
  /**
   * Activación confirmada del servicio. Va separada de la instalación física:
   * sin API de la plataforma GPS, la confirma una persona (diagnóstico §4.4).
   */
  activadoEn: Iso | null;
  motivoBaja: string | null;
  /** Ejecutivo o persona de Operaciones a cargo del caso. */
  responsableId: string;
}

/** Nota administrativa interna sobre un cliente. */
export interface Nota {
  id: string;
  clienteId: string;
  autorId: string;
  texto: string;
  en: Iso;
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
  | "pendiente_pago"
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
  pasarela: Pasarela;
  pagoRef: string | null;
  creadaEn: Iso;
  pagadaEn: Iso | null;
}

/** Webpay quedó decidido el 15/10; Mercado Pago se discutió después (PENDIENTE). */
export type Pasarela = "webpay" | "mercadopago";

/**
 * Intento de pago de una orden. Va separado de la orden para no confundir
 * «orden creada» con «pago confirmado» ni declarar ingresos sin pago.
 */
export interface Pago {
  id: string;
  ordenFolio: string;
  clienteId: string;
  monto: number;
  pasarela: Pasarela;
  estado: "pendiente" | "aprobado" | "rechazado" | "reembolsado";
  ref: string | null;
  motivo: string | null;
  creadoEn: Iso;
  resueltoEn: Iso | null;
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

export type EstadoTecnico = "postulante" | "en_validacion" | "activo" | "suspendido" | "baja";

export interface DocumentoTecnico {
  tipo: "cedula" | "antecedentes" | "licencia" | "certificacion";
  estado: "pendiente" | "aprobado" | "rechazado";
}

export interface Tecnico {
  id: string;
  nombre: string;
  rut: string;
  telefono: string;
  email: string;
  comunas: string[];
  estado: EstadoTecnico;
  cupoDiario: number;
  validadoEn: IsoDate | null;
  postuladoEn: IsoDate;
  experienciaAnios: number;
  /** Marcas o tipos de vehículo en que tiene experiencia, declarados al postular. */
  especialidades: string[];
  documentos: DocumentoTecnico[];
  /** Bloques que acepta tomar, por día de la semana (1 = lunes … 6 = sábado). */
  disponibilidad: Record<number, string[]>;
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
  /** Ítems del checklist del técnico marcados como hechos. */
  checklist: string[];
  observaciones: string | null;
  /** Fotos de evidencia (en la demo solo se cuentan; no hay archivos). */
  fotos: number;
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
  responsableId: string | null;
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

// ——— Integraciones (demo) ———

/** Evento recibido de otro sistema (sitio o portal del técnico) y aplicado en el CRM. */
export interface EntradaIntegracion {
  /** id del evento de origen: sirve para no aplicarlo dos veces (idempotencia). */
  id: string;
  tipo: string;
  origen: "sitio" | "portal";
  recibidoEn: Iso;
  resumen: string;
  clienteId: string | null;
}

// ——— Bitácora inmutable (tabla eventos) ———

export interface Evento {
  id: string;
  /** Null en eventos que no son de un cliente (técnicos, inventario). */
  clienteId: string | null;
  entidad: "cliente" | "orden" | "visita" | "suscripcion" | "ticket" | "plataforma" | "tecnico" | "dispositivo";
  entidadRef: string;
  tipo: string;
  detalle: string | null;
  actor: "sistema" | "cliente" | "tecnico" | "operaciones";
  en: Iso;
  /** Lo generó una acción de la demo, no la semilla. */
  demo?: boolean;
}
