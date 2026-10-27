import "server-only";

// Capa de acceso a datos. Las pantallas solo leen desde aquí: hoy desde los datos
// ficticios de seed.ts y, con la base lista, desde Supabase con Drizzle, sin
// cambiar las pantallas. Todas las funciones son async por eso.

import { connection } from "next/server";
import type { IsoDate } from "@/lib/format";
import { ESTADOS_CLIENTE, type Cliente, type EstadoCliente, type Visita } from "@/lib/domain/types";
import { addDays, buildDb, santiagoToday, type Db } from "./seed";

let cache: Db | null = null;

// Los datos dependen de la fecha de hoy: se leen en cada solicitud, no al compilar.
async function load(): Promise<Db> {
  await connection();
  return db();
}

function db(): Db {
  const hoy = santiagoToday();
  if (!cache || cache.hoy !== hoy) cache = buildDb(hoy);
  return cache;
}

export async function hoy(): Promise<IsoDate> {
  await load();
  return db().hoy;
}

// ——— Clientes ———

export async function listClientes(filtro: { estado?: EstadoCliente; q?: string } = {}) {
  await load();
  const q = filtro.q ? plain(filtro.q) : "";
  return db()
    .clientes.filter((c) => !filtro.estado || c.estado === filtro.estado)
    .filter(
      (c) =>
        !q ||
        plain([c.nombre, c.rut, c.rut.replace(/\./g, ""), c.email, c.comuna, ...vehiculosDe(c.id).map((v) => v.patente)].join(" ")).includes(q),
    )
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((c) => ({ ...c, vehiculos: vehiculosDe(c.id), orden: ordenDe(c.id) }));
}

/** Minúsculas y sin tildes, para buscar «nunoa» y encontrar Ñuñoa. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function vehiculosDe(clienteId: string) {
  return db().vehiculos.filter((v) => v.clienteId === clienteId);
}

function ordenDe(clienteId: string) {
  return db().ordenes.find((o) => o.clienteId === clienteId) ?? null;
}

export async function getCliente(id: string) {
  await load();
  const d = db();
  const cliente = d.clientes.find((c) => c.id === id);
  if (!cliente) return null;
  return {
    cliente,
    vehiculos: vehiculosDe(id),
    ordenes: d.ordenes.filter((o) => o.clienteId === id),
    suscripciones: d.suscripciones.filter((s) => s.clienteId === id),
    cobros: d.cobros.filter((c) => c.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    visitas: d.visitas
      .filter((v) => v.clienteId === id)
      .map((v) => ({ ...v, tecnico: d.tecnicos.find((t) => t.id === v.tecnicoId)?.nombre ?? null })),
    tickets: d.tickets.filter((t) => t.clienteId === id),
    cuenta: d.cuentas.find((c) => c.clienteId === id) ?? null,
    alertas: d.alertas.filter((a) => a.clienteId === id).sort((a, b) => b.en.localeCompare(a.en)),
    dispositivos: d.dispositivos.filter((x) => vehiculosDe(id).some((v) => v.id === x.vehiculoId)),
    eventos: d.eventos.filter((e) => e.clienteId === id).reverse(),
  };
}

export type ClienteDetalle = NonNullable<Awaited<ReturnType<typeof getCliente>>>;

/** Clientes agrupados por los 6 estados principales, para el tablero de ventas. */
export async function tableroVentas() {
  await load();
  const clientes = await listClientes();
  return ESTADOS_CLIENTE.map((estado) => ({ estado, clientes: clientes.filter((c) => c.estado === estado) }));
}

// ——— Ventas ———

export async function listOrdenes() {
  await load();
  const d = db();
  return [...d.ordenes]
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
    .map((o) => ({ ...o, cliente: d.clientes.find((c) => c.id === o.clienteId)! }));
}

// ——— Operaciones ———

export async function listTecnicos() {
  await load();
  const d = db();
  const mes = d.hoy.slice(0, 7);
  return d.tecnicos.map((t) => {
    const suyas = d.visitas.filter((v) => v.tecnicoId === t.id);
    return {
      ...t,
      visitasMes: suyas.filter((v) => v.fecha?.startsWith(mes) && v.estado === "cerrada_ok").length,
      proximas: suyas.filter((v) => v.fecha && v.fecha >= d.hoy && ["agendada", "confirmada", "en_camino", "en_sitio", "en_instalacion", "en_pruebas"].includes(v.estado)).length,
      fallidas: suyas.filter((v) => v.estado === "fallida").length,
      noShows: suyas.filter((v) => v.estado === "no_show_cliente").length,
      custodia: d.dispositivos.filter((x) => x.custodiaTecnicoId === t.id && x.estado === "asignado").length,
    };
  });
}

export type VisitaFila = Visita & {
  cliente: Cliente;
  vehiculo: { patente: string; marca: string; modelo: string };
  tecnico: string | null;
};

export async function listVisitas(): Promise<VisitaFila[]> {
  await load();
  const d = db();
  return d.visitas.map((v) => {
    const veh = d.vehiculos.find((x) => x.id === v.vehiculoId)!;
    return {
      ...v,
      cliente: d.clientes.find((c) => c.id === v.clienteId)!,
      vehiculo: { patente: veh.patente, marca: veh.marca, modelo: veh.modelo },
      tecnico: d.tecnicos.find((t) => t.id === v.tecnicoId)?.nombre ?? null,
    };
  });
}

export async function getVisita(folio: string) {
  await load();
  const visitas = await listVisitas();
  const visita = visitas.find((v) => v.folio === folio);
  if (!visita) return null;
  const d = db();
  return {
    visita,
    tecnico: d.tecnicos.find((t) => t.id === visita.tecnicoId) ?? null,
    eventos: d.eventos.filter((e) => e.entidadRef === folio).reverse(),
    ticket: d.tickets.find((t) => t.folio === visita.ticketFolio || t.visitaFolio === folio) ?? null,
    planId:
      d.suscripciones.find((s) => s.vehiculoId === visita.vehiculoId)?.planId ??
      d.ordenes.find((o) => o.clienteId === visita.clienteId)?.planId ??
      null,
  };
}

/** Semana de agenda: lunes a sábado, una columna por técnico activo. */
export async function agendaSemana(offset: number) {
  await load();
  const d = db();
  const dow = new Date(`${d.hoy}T12:00:00Z`).getUTCDay() || 7;
  const lunes = addDays(d.hoy, 1 - dow + offset * 7);
  const dias = Array.from({ length: 6 }, (_, i) => addDays(lunes, i));
  const visitas = await listVisitas();
  const tecnicos = d.tecnicos.filter((t) => t.estado === "activo");
  return {
    hoy: d.hoy,
    dias,
    tecnicos: tecnicos.map((t) => ({
      ...t,
      visitas: visitas.filter((v) => v.tecnicoId === t.id && v.fecha && dias.includes(v.fecha)),
    })),
  };
}

export async function listDispositivos() {
  await load();
  const d = db();
  return d.dispositivos.map((x) => {
    const veh = d.vehiculos.find((v) => v.id === x.vehiculoId);
    return {
      ...x,
      patente: veh?.patente ?? null,
      clienteId: veh?.clienteId ?? null,
      tecnico: d.tecnicos.find((t) => t.id === x.custodiaTecnicoId)?.nombre ?? null,
    };
  });
}

// ——— Soporte y cobro ———

export async function listTickets() {
  await load();
  const d = db();
  return [...d.tickets]
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((t) => ({
      ...t,
      cliente: d.clientes.find((c) => c.id === t.clienteId)!,
      patente: d.vehiculos.find((v) => v.id === t.vehiculoId)?.patente ?? null,
    }));
}

export async function listSuscripciones() {
  await load();
  const d = db();
  return d.suscripciones.map((s) => ({
    ...s,
    cliente: d.clientes.find((c) => c.id === s.clienteId)!,
    patente: d.vehiculos.find((v) => v.id === s.vehiculoId)?.patente ?? "",
  }));
}

// ——— Inicio ———

export async function resumen() {
  await load();
  const d = db();
  const hace30 = addDays(d.hoy, -30);
  const pagadas = d.ordenes.filter((o) => o.pagadaEn);
  const ventasMes = pagadas.filter((o) => o.pagadaEn!.slice(0, 10) > hace30);
  const activas = d.suscripciones.filter((s) => s.estado === "activa" || s.estado === "pago_pendiente");
  const mrr = activas.reduce((sum, s) => sum + (s.periodicidad === "anual" ? Math.round(s.montoPeriodo / 12) : s.montoPeriodo), 0);
  const estados = Object.fromEntries(ESTADOS_CLIENTE.map((e) => [e, d.clientes.filter((c) => c.estado === e).length])) as Record<EstadoCliente, number>;
  const visitas = await listVisitas();
  const hoyVisitas = visitas.filter((v) => v.fecha === d.hoy && v.estado !== "cancelada").sort((a, b) => (a.bloque ?? "").localeCompare(b.bloque ?? ""));

  const leads = d.clientes.length;
  const checkout = d.ordenes.length;
  const pagos = pagadas.length;
  const agendados = new Set(d.visitas.filter((v) => v.tecnicoId).map((v) => v.clienteId)).size;
  const instalados = d.clientes.filter((c) => c.instaladoEn).length;

  // Ventas por semana (últimas 8)
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const fin = addDays(d.hoy, -7 * (7 - i));
    const ini = addDays(fin, -6);
    const os = pagadas.filter((o) => o.pagadaEn!.slice(0, 10) >= ini && o.pagadaEn!.slice(0, 10) <= fin);
    return { ini, fin, ventas: os.length, monto: os.reduce((s, o) => s + o.montoTotal, 0) };
  });

  return {
    hoy: d.hoy,
    ventasMes: ventasMes.length,
    montoMes: ventasMes.reduce((s, o) => s + o.montoTotal, 0),
    mrr,
    activos: estados.ACTIVO,
    estados,
    embudo: [
      { etapa: "Leads", valor: leads },
      { etapa: "Checkout iniciado", valor: checkout },
      { etapa: "Pagados", valor: pagos },
      { etapa: "Agendados", valor: agendados },
      { etapa: "Instalados", valor: instalados },
    ],
    semanas,
    hoyVisitas,
    requierePersona: visitas.filter((v) => v.estado === "requiere_persona" || v.estado === "lista_espera"),
    porAgendar: visitas.filter((v) => v.estado === "por_agendar"),
    incidencias: visitas.filter((v) => v.estado === "fallida"),
    ticketsAbiertos: d.tickets.filter((t) => t.estado !== "RESUELTO").length,
    urgentes: d.tickets.filter((t) => t.nivel === "URGENTE" && t.estado !== "RESUELTO").length,
    morosos: d.suscripciones.filter((s) => s.estado === "pago_pendiente").length,
    suspendidos: d.suscripciones.filter((s) => s.estado === "suspendida").length,
    abandonados: d.clientes.filter((c) => c.subestado === "CHECKOUT ABANDONADO").length,
    actividad: [...d.eventos].reverse().slice(0, 12).map((e) => ({ ...e, cliente: d.clientes.find((c) => c.id === e.clienteId)! })),
  };
}
