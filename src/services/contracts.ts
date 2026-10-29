// Contratos PROVISORIOS de la capa de servicios. Las pantallas solo hablan con
// estas interfaces; hoy las implementa el proveedor mock (`./mock`) y mañana un
// proveedor que llame a la API real, sin tocar las pantallas.
//
// Los nombres en inglés son los del contrato acordado para el equipo (Customer,
// Order, …) y apuntan al modelo de dominio en español de `lib/domain/types.ts`.
// No están acoplados a tablas de Supabase: la forma de la base está por decidir
// con Adolfo, Camila y Matías (ver docs/contratos-api.md).

import type { IsoDate } from "@/lib/format";
import type { Billing, PlanId } from "@/lib/plans";
import type { Etapa } from "@/lib/domain/pipeline";
import type { BloqueLibre } from "@/lib/domain/agenda";
import type { CambiosCliente, DatosLead, DatosTecnico, DatosVehiculo } from "@/lib/domain/engine";
import type {
  CausaFalla,
  Cliente,
  Dispositivo,
  DocumentoTecnico,
  EntradaIntegracion,
  EstadoCliente,
  EstadoTecnico,
  EstadoTicket,
  Nivel,
  Orden,
  OrigenTicket,
  Pago,
  Suscripcion,
  Tecnico,
  Ticket,
  Usuario,
  Vehiculo,
  Visita,
} from "@/lib/domain/types";
import type * as Q from "./mock/queries";
import type { Evento } from "./eventos";

// ——— Entidades del contrato ———

export type Customer = Cliente;
/** Un lead es un Customer en estado LEAD: se separa en una entidad propia cuando exista el CRM matriz. */
export type Lead = Cliente & { estado: "LEAD" };
export type Vehicle = Vehiculo;
export type Device = Dispositivo;
export type Order = Orden;
export type Payment = Pago;
export type Subscription = Suscripcion;
export type Installer = Tecnico;
export type Appointment = Visita;
export type SupportTicket = Ticket;
export type TeamMember = Usuario;

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Rango de fechas de los indicadores. */
export type Periodo = "7d" | "30d" | "90d" | "mes";

// ——— Servicios ———

export interface CustomerService {
  list(filter?: { estado?: EstadoCliente; q?: string }): Promise<Q.ClienteFila[]>;
  get(id: string): Promise<Q.ClienteDetalle | null>;
  team(): Promise<TeamMember[]>;
  create(data: DatosLead): Promise<Result<{ id: string }>>;
  update(id: string, changes: CambiosCliente): Promise<Result>;
  addVehicle(id: string, vehicle: DatosVehiculo): Promise<Result>;
  addNote(id: string, text: string): Promise<Result>;
}

export interface PipelineService {
  board(filter?: Q.FiltroPipeline): Promise<Q.Tablero>;
  /** Ejecuta el evento del sistema que lleva el caso a la etapa siguiente. */
  advance(customerId: string, input?: { planId?: PlanId; billing?: Billing }): Promise<Result<{ etapa: Etapa | null }>>;
  /** Eventos generados por acciones de la demo (historial auditable de la sesión). */
  history(limit?: number): Promise<Q.EventoDemo[]>;
}

export interface OrderService {
  list(): Promise<Q.OrdenFila[]>;
  startCheckout(customerId: string, planId: PlanId, billing: Billing): Promise<Result<{ folio: string }>>;
  sendToGateway(folio: string): Promise<Result>;
  confirmPayment(folio: string): Promise<Result>;
  rejectPayment(folio: string): Promise<Result>;
  refund(folio: string, reason: string): Promise<Result>;
  createInstallationOrder(customerId: string): Promise<Result<{ folios: string[] }>>;
}

export interface InstallerService {
  list(): Promise<Q.TecnicoFila[]>;
  get(id: string): Promise<Q.TecnicoDetalle | null>;
  apply(data: DatosTecnico): Promise<Result<{ id: string }>>;
  setStatus(id: string, status: EstadoTecnico): Promise<Result>;
  reviewDocument(id: string, doc: DocumentoTecnico["tipo"], status: DocumentoTecnico["estado"]): Promise<Result>;
  update(id: string, data: { cupoDiario: number; comunas: string[]; disponibilidad: Record<number, string[]> }): Promise<Result>;
  appointments(): Promise<Q.VisitaFila[]>;
  appointment(folio: string): Promise<Q.VisitaDetalle | null>;
  calendar(from: IsoDate, days: number): Promise<Q.Calendario>;
  availableSlots(folio: string): Promise<BloqueLibre[]>;
  book(folio: string, installerId: string, date: IsoDate, block: string): Promise<Result>;
  advance(folio: string, status: "confirmada" | "en_camino" | "en_instalacion" | "en_pruebas"): Promise<Result>;
  toggleChecklist(folio: string, item: string, done: boolean): Promise<Result>;
  addPhoto(folio: string): Promise<Result>;
  saveNotes(folio: string, text: string): Promise<Result>;
  complete(folio: string, imeiGps: string, imeiTag: string | null): Promise<Result>;
  fail(folio: string, cause: CausaFalla): Promise<Result>;
  cancel(folio: string, reason: string): Promise<Result>;
  /** Solo demo: recorre check-in, checklist, fotos, pruebas y cierre en un paso. */
  simulateInstallation(folio: string): Promise<Result>;
}

export interface DeviceService {
  list(): Promise<Q.DispositivoFila[]>;
  /** Equipos disponibles para instalar (bodega o custodia del técnico). */
  available(tipo: "gps" | "tag", installerId: string | null): Promise<Dispositivo[]>;
  /** Activación del servicio. Demo: no llama a GPSTracker. */
  activate(customerId: string): Promise<Result>;
}

export interface BillingService {
  subscriptions(): Promise<Q.SuscripcionFila[]>;
  cancelSubscription(id: string, reason: string): Promise<Result>;
  retryCharge(id: string, approved: boolean): Promise<Result>;
  finance(periodo: Periodo): Promise<Q.Finanzas>;
}

export interface SupportService {
  list(): Promise<Q.TicketFila[]>;
  create(data: { customerId: string; vehicleId: string | null; subject: string; detail: string; level: Nivel; origin: OrigenTicket; assigneeId: string | null }): Promise<Result<{ folio: string }>>;
  setStatus(folio: string, status: EstadoTicket): Promise<Result>;
  assign(folio: string, assigneeId: string | null): Promise<Result>;
}

export interface PasoIntegracion {
  label: string;
  estado: "ok" | "omitido" | "aviso";
  detalle?: string;
}

/** Eventos con el sitio y el portal del técnico (demo: por enlace; producción: webhooks). */
export interface IntegrationService {
  inbox(): Promise<EntradaIntegracion[]>;
  applied(eventId: string): Promise<EntradaIntegracion | null>;
  receive(event: Evento): Promise<Result<{ pasos: PasoIntegracion[]; clienteId: string | null; visitaFolio: string | null }>>;
  /** Evento «crm.visita» para enviar una visita al portal del técnico. */
  visitForPortal(folio: string): Promise<Result<Evento>>;
}

export interface DashboardService {
  summary(periodo: Periodo): Promise<Q.Resumen>;
  /** Fecha de hoy en Santiago según la fuente de datos. */
  today(): Promise<IsoDate>;
}

export interface Services {
  customers: CustomerService;
  pipeline: PipelineService;
  orders: OrderService;
  installers: InstallerService;
  devices: DeviceService;
  billing: BillingService;
  support: SupportService;
  dashboard: DashboardService;
  integration: IntegrationService;
}
