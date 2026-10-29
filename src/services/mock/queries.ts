// Consultas del proveedor mock: funciones puras sobre el conjunto de datos de la
// demo. Todos los indicadores salen de aquí, del mismo Db, para que ninguna
// pantalla muestre cifras que no cuadren con otra.

import type { Db } from "@/data/seed";
import { addDays } from "@/data/seed";
import { daysBetween, type IsoDate } from "@/lib/format";
import { getPlan, type PlanId } from "@/lib/plans";
import { ESTADOS_CLIENTE, type Cliente, type EstadoCliente, type Evento, type Origen, type Visita } from "@/lib/domain/types";
import { grupoVisita, VISITA_ACTIVA, type GrupoVisita, type Tone } from "@/lib/domain/labels";
import { ETAPAS, etapaDe, siguienteAccion, type Etapa } from "@/lib/domain/pipeline";
import type { Periodo } from "../contracts";

/** Pago por visita al técnico. ILUSTRATIVO: tarifa POR DEFINIR con Operaciones. */
export const TARIFA_VISITA_DEMO = 28_000;
/** Período de gracia antes de suspender (~15 días, REFERENCIAL en el blueprint). */
export const GRACIA_DIAS = 15;

const dia = (iso: string) => iso.slice(0, 10);

/** Minúsculas y sin tildes, para buscar «nunoa» y encontrar Ñuñoa. */
export function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function vehiculosDe(db: Db, clienteId: string) {
  return db.vehiculos.filter((v) => v.clienteId === clienteId);
}

/** Orden vigente del cliente: la última creada. */
function ordenDe(db: Db, clienteId: string) {
  const os = db.ordenes.filter((o) => o.clienteId === clienteId);
  return os.length ? os.reduce((a, b) => (b.creadaEn > a.creadaEn ? b : a)) : null;
}

function nombreUsuario(db: Db, id: string | null) {
  return db.usuarios.find((u) => u.id === id)?.nombre ?? null;
}

export function etapaCliente(db: Db, c: Cliente): Etapa | null {
  return etapaDe(c, ordenDe(db, c.id), db.visitas.filter((v) => v.clienteId === c.id));
}

// ——— Clientes ———

export function listClientes(db: Db, filtro: { estado?: EstadoCliente; q?: string } = {}) {
  const q = filtro.q ? plain(filtro.q) : "";
  return db.clientes
    .filter((c) => !filtro.estado || c.estado === filtro.estado)
    .filter(
      (c) =>
        !q ||
        plain([c.nombre, c.rut, c.rut.replace(/\./g, ""), c.email, c.comuna, ...vehiculosDe(db, c.id).map((v) => v.patente)].join(" ")).includes(q),
    )
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((c) => ({
      ...c,
      vehiculos: vehiculosDe(db, c.id),
      orden: ordenDe(db, c.id),
      etapa: etapaCliente(db, c),
      responsable: nombreUsuario(db, c.responsableId),
    }));
}
export type ClienteFila = ReturnType<typeof listClientes>[number];

export function getCliente(db: Db, id: string) {
  const cliente = db.clientes.find((c) => c.id === id);
  if (!cliente) return null;
  const vehiculos = vehiculosDe(db, id);
  const orden = ordenDe(db, id);
  const etapa = etapaCliente(db, cliente);
  return {
    cliente,
    hoy: db.hoy,
    etapa,
    siguienteAccion: etapa ? siguienteAccion(etapa, cliente, orden) : null,
    responsable: nombreUsuario(db, cliente.responsableId),
    vehiculos,
    ordenes: db.ordenes.filter((o) => o.clienteId === id).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)),
    pagos: db.pagos.filter((p) => p.clienteId === id).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)),
    suscripciones: db.suscripciones.filter((s) => s.clienteId === id),
    cobros: db.cobros.filter((c) => c.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    visitas: db.visitas
      .filter((v) => v.clienteId === id)
      .map((v) => ({ ...v, tecnico: db.tecnicos.find((t) => t.id === v.tecnicoId)?.nombre ?? null, grupo: grupoVisita(v.estado) })),
    tickets: db.tickets.filter((t) => t.clienteId === id).map((t) => ({ ...t, responsable: nombreUsuario(db, t.responsableId) })),
    cuenta: db.cuentas.find((c) => c.clienteId === id) ?? null,
    alertas: db.alertas.filter((a) => a.clienteId === id).sort((a, b) => b.en.localeCompare(a.en)),
    dispositivos: db.dispositivos.filter((x) => vehiculos.some((v) => v.id === x.vehiculoId)),
    eventos: db.eventos.filter((e) => e.clienteId === id).reverse(),
    notas: db.notas
      .filter((n) => n.clienteId === id)
      .map((n) => ({ ...n, autor: nombreUsuario(db, n.autorId) ?? "Operaciones" }))
      .sort((a, b) => b.en.localeCompare(a.en)),
  };
}
export type ClienteDetalle = NonNullable<ReturnType<typeof getCliente>>;

// ——— Pipeline ———

export interface FiltroPipeline {
  q?: string;
  responsableId?: string;
  planId?: PlanId;
  origen?: Origen;
}

export function tablero(db: Db, f: FiltroPipeline = {}) {
  const clientes = listClientes(db, { q: f.q });
  const tarjetas = clientes
    .filter((c) => c.etapa !== null)
    .filter((c) => !f.responsableId || c.responsableId === f.responsableId)
    .filter((c) => !f.planId || c.orden?.planId === f.planId)
    .filter((c) => !f.origen || c.origen === f.origen)
    .map((c) => {
      const etapa = c.etapa!;
      const visita = db.visitas
        .filter((v) => v.clienteId === c.id && v.estado !== "cancelada")
        .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0];
      return {
        id: c.id,
        nombre: c.nombre,
        etapa,
        estado: c.estado,
        subestado: c.subestado,
        comuna: c.comuna,
        origen: c.origen,
        creadoEn: c.creadoEn,
        plan: c.orden ? getPlan(c.orden.planId).name : null,
        periodicidad: c.orden?.periodicidad ?? null,
        vehiculo: c.vehiculos[0] ? `${c.vehiculos[0].marca} ${c.vehiculos[0].modelo}` : null,
        patente: c.vehiculos[0]?.patente ?? null,
        vehiculos: c.vehiculos.length,
        monto: c.orden?.montoTotal ?? null,
        ordenEstado: c.orden?.estado ?? null,
        responsableId: c.responsableId,
        responsable: c.responsable,
        siguienteAccion: siguienteAccion(etapa, c, c.orden),
        visita: visita ? { folio: visita.folio, fecha: visita.fecha, bloque: visita.bloque, estado: visita.estado } : null,
      };
    });
  return {
    hoy: db.hoy,
    columnas: ETAPAS.map((etapa) => {
      const lista = tarjetas.filter((t) => t.etapa === etapa);
      return { etapa, tarjetas: lista, monto: lista.reduce((s, t) => s + (t.monto ?? 0), 0) };
    }),
    fuera: clientes.filter((c) => c.etapa === null).length,
    total: tarjetas.length,
  };
}
export type Tablero = ReturnType<typeof tablero>;
export type TarjetaPipeline = Tablero["columnas"][number]["tarjetas"][number];

// ——— Órdenes y pagos ———

export function listOrdenes(db: Db) {
  return [...db.ordenes]
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
    .map((o) => ({
      ...o,
      cliente: db.clientes.find((c) => c.id === o.clienteId)!,
      pagos: db.pagos.filter((p) => p.ordenFolio === o.folio).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)),
    }));
}
export type OrdenFila = ReturnType<typeof listOrdenes>[number];

// ——— Técnicos y visitas ———

export function listVisitas(db: Db) {
  return db.visitas.map((v) => {
    const veh = db.vehiculos.find((x) => x.id === v.vehiculoId)!;
    return {
      ...v,
      cliente: db.clientes.find((c) => c.id === v.clienteId)!,
      vehiculo: { patente: veh.patente, marca: veh.marca, modelo: veh.modelo },
      tecnico: db.tecnicos.find((t) => t.id === v.tecnicoId)?.nombre ?? null,
      grupo: grupoVisita(v.estado) as GrupoVisita,
    };
  });
}
export type VisitaFila = ReturnType<typeof listVisitas>[number];

function metricasTecnico(db: Db, tecnicoId: string) {
  const mes = db.hoy.slice(0, 7);
  const suyas = db.visitas.filter((v) => v.tecnicoId === tecnicoId);
  const terminadas = suyas.filter((v) => ["cerrada_ok", "fallida", "no_show_cliente"].includes(v.estado));
  const ok = suyas.filter((v) => v.estado === "cerrada_ok");
  return {
    visitasMes: ok.filter((v) => v.fecha?.startsWith(mes)).length,
    completadas: ok.length,
    proximas: suyas.filter((v) => v.fecha && v.fecha >= db.hoy && VISITA_ACTIVA.includes(v.estado)).length,
    fallidas: suyas.filter((v) => v.estado === "fallida").length,
    noShows: suyas.filter((v) => v.estado === "no_show_cliente").length,
    exito: terminadas.length ? Math.round((ok.length / terminadas.length) * 100) : null,
    custodia: db.dispositivos.filter((x) => x.custodiaTecnicoId === tecnicoId && x.estado === "asignado").length,
    pagoMes: ok.filter((v) => v.fecha?.startsWith(mes)).length * TARIFA_VISITA_DEMO,
  };
}

export function listTecnicos(db: Db) {
  return db.tecnicos.map((t) => ({ ...t, ...metricasTecnico(db, t.id) }));
}
export type TecnicoFila = ReturnType<typeof listTecnicos>[number];

export function getTecnico(db: Db, id: string) {
  const tecnico = db.tecnicos.find((t) => t.id === id);
  if (!tecnico) return null;
  return {
    tecnico,
    hoy: db.hoy,
    metricas: metricasTecnico(db, id),
    visitas: listVisitas(db)
      .filter((v) => v.tecnicoId === id)
      .sort((a, b) => `${b.fecha}${b.bloque}`.localeCompare(`${a.fecha}${a.bloque}`)),
    custodia: db.dispositivos.filter((d) => d.custodiaTecnicoId === id && d.estado === "asignado"),
    eventos: db.eventos.filter((e) => e.entidad === "tecnico" && e.entidadRef === id).reverse(),
  };
}
export type TecnicoDetalle = NonNullable<ReturnType<typeof getTecnico>>;

export function getVisita(db: Db, folio: string) {
  const visita = listVisitas(db).find((v) => v.folio === folio);
  if (!visita) return null;
  return {
    visita,
    hoy: db.hoy,
    tecnico: db.tecnicos.find((t) => t.id === visita.tecnicoId) ?? null,
    eventos: db.eventos.filter((e) => e.entidadRef === folio).reverse(),
    ticket: db.tickets.find((t) => t.folio === visita.ticketFolio || t.visitaFolio === folio) ?? null,
    planId:
      db.suscripciones.find((s) => s.vehiculoId === visita.vehiculoId)?.planId ??
      db.ordenes.find((o) => o.clienteId === visita.clienteId && o.estado === "pagada")?.planId ??
      null,
  };
}
export type VisitaDetalle = NonNullable<ReturnType<typeof getVisita>>;

export function calendario(db: Db, desde: IsoDate, dias: number) {
  const fechas = Array.from({ length: dias }, (_, i) => addDays(desde, i));
  return {
    hoy: db.hoy,
    dias: fechas,
    tecnicos: db.tecnicos.filter((t) => t.estado === "activo" || db.visitas.some((v) => v.tecnicoId === t.id && v.fecha && fechas.includes(v.fecha))),
    visitas: listVisitas(db).filter((v) => v.fecha && fechas.includes(v.fecha)),
  };
}
export type Calendario = ReturnType<typeof calendario>;

// ——— Dispositivos ———

export function listDispositivos(db: Db) {
  return db.dispositivos.map((x) => {
    const veh = db.vehiculos.find((v) => v.id === x.vehiculoId);
    const cliente = veh ? db.clientes.find((c) => c.id === veh.clienteId) : undefined;
    const visita = db.visitas.find((v) => v.estado === "cerrada_ok" && v.vehiculoId === veh?.id && v.checkOutEn);
    return {
      ...x,
      patente: veh?.patente ?? null,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente?.nombre ?? null,
      tecnico: db.tecnicos.find((t) => t.id === x.custodiaTecnicoId)?.nombre ?? null,
      instaladoEn: visita?.checkOutEn ?? null,
    };
  });
}
export type DispositivoFila = ReturnType<typeof listDispositivos>[number];

// ——— Soporte y cobro ———

export function listTickets(db: Db) {
  return [...db.tickets]
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((t) => ({
      ...t,
      cliente: db.clientes.find((c) => c.id === t.clienteId)!,
      patente: db.vehiculos.find((v) => v.id === t.vehiculoId)?.patente ?? null,
      responsable: nombreUsuario(db, t.responsableId),
    }));
}
export type TicketFila = ReturnType<typeof listTickets>[number];

export function listSuscripciones(db: Db) {
  return db.suscripciones.map((s) => ({
    ...s,
    cliente: db.clientes.find((c) => c.id === s.clienteId)!,
    patente: db.vehiculos.find((v) => v.id === s.vehiculoId)?.patente ?? "",
    diasMora: s.morosoDesde ? daysBetween(s.morosoDesde, db.hoy) : null,
    eventos: db.eventos
      .filter((e) => e.clienteId === s.clienteId && (e.entidad === "suscripcion" || ["ACTIVO", "CANCELADO", "SUSPENDIDO", "VEHÍCULO ACTIVO"].includes(e.tipo)))
      .reverse(),
  }));
}
export type SuscripcionFila = ReturnType<typeof listSuscripciones>[number];

/** Ingreso mensual recurrente: anuales prorrateados en 12. */
function mrrDe(db: Db) {
  return db.suscripciones
    .filter((s) => s.estado === "activa" || s.estado === "pago_pendiente")
    .reduce((t, s) => t + (s.periodicidad === "anual" ? Math.round(s.montoPeriodo / 12) : s.montoPeriodo), 0);
}

// ——— Períodos ———

export function rango(hoy: IsoDate, periodo: Periodo) {
  const largo = periodo === "7d" ? 7 : periodo === "30d" ? 30 : periodo === "90d" ? 90 : Number(hoy.slice(8, 10));
  const desde = addDays(hoy, -(largo - 1));
  return { desde, hasta: hoy, largo, antDesde: addDays(desde, -largo), antHasta: addDays(desde, -1) };
}

const entre = (iso: string | null, a: IsoDate, b: IsoDate) => !!iso && dia(iso) >= a && dia(iso) <= b;

/** Ingresos confirmados: pagos iniciales aprobados + cobros recurrentes aprobados − reembolsos. */
function ingresos(db: Db, a: IsoDate, b: IsoDate) {
  const iniciales = db.pagos.filter((p) => (p.estado === "aprobado" || p.estado === "reembolsado") && entre(p.creadoEn, a, b)).reduce((s, p) => s + p.monto, 0);
  const recurrentes = db.cobros.filter((c) => c.estado === "aprobado" && entre(c.fecha, a, b)).reduce((s, c) => s + c.monto, 0);
  const reembolsos = db.pagos.filter((p) => p.estado === "reembolsado" && entre(p.resueltoEn, a, b)).reduce((s, p) => s + p.monto, 0);
  return { iniciales, recurrentes, reembolsos, neto: iniciales + recurrentes - reembolsos };
}

/** Cortes de la serie: por día hasta 31 días, por semana sobre eso. */
function cortes(desde: IsoDate, hasta: IsoDate) {
  const total = daysBetween(desde, hasta) + 1;
  const paso = total > 31 ? 7 : 1;
  const out: { ini: IsoDate; fin: IsoDate }[] = [];
  for (let i = 0; i < total; i += paso) {
    const ini = addDays(desde, i);
    const fin = addDays(desde, Math.min(total - 1, i + paso - 1));
    out.push({ ini, fin });
  }
  return { paso, out };
}

// ——— Inicio (dashboard) ———

export interface AlertaOperativa {
  id: string;
  tone: Tone;
  titulo: string;
  detalle: string;
  href: string;
}

export function resumen(db: Db, periodo: Periodo) {
  const r = rango(db.hoy, periodo);
  const ing = ingresos(db, r.desde, r.hasta);
  const ingAnt = ingresos(db, r.antDesde, r.antHasta);
  const pagosAprob = (a: IsoDate, b: IsoDate) => db.pagos.filter((p) => p.estado !== "pendiente" && p.estado !== "rechazado" && entre(p.creadoEn, a, b));
  const visitas = listVisitas(db);
  const instalacion = visitas.filter((v) => v.tipo === "instalacion" || v.tipo === "segunda_visita");

  const leads = db.clientes.filter((c) => entre(c.creadoEn, r.desde, r.hasta)).length;
  const checkouts = db.ordenes.filter((o) => entre(o.creadaEn, r.desde, r.hasta)).length;
  const pagos = pagosAprob(r.desde, r.hasta).length;
  const instaladas = db.clientes.filter((c) => entre(c.instaladoEn, r.desde, r.hasta)).length;
  const activaciones = db.clientes.filter((c) => entre(c.activadoEn, r.desde, r.hasta)).length;

  const { paso, out } = cortes(r.desde, r.hasta);
  const serie = out.map(({ ini, fin }) => {
    const x = ingresos(db, ini, fin);
    return { ini, fin, iniciales: x.iniciales, recurrentes: x.recurrentes, ventas: pagosAprob(ini, fin).length };
  });

  const estados = Object.fromEntries(ESTADOS_CLIENTE.map((e) => [e, db.clientes.filter((c) => c.estado === e).length])) as Record<EstadoCliente, number>;
  const subs = db.suscripciones;
  const morosas = subs.filter((s) => s.estado === "pago_pendiente" || s.estado === "suspendida");

  // Alertas operativas: lo que necesita a una persona hoy.
  const alertas: AlertaOperativa[] = [];
  for (const v of instalacion.filter((x) => x.estado === "requiere_persona")) {
    alertas.push({ id: `rp-${v.folio}`, tone: "danger", titulo: "Sin cupo tras lista de espera", detalle: `${v.cliente.nombre} · ${v.comuna}`, href: `/visitas/${v.folio}` });
  }
  for (const v of visitas.filter((x) => x.grupo === "revision" && x.estado !== "requiere_persona")) {
    alertas.push({ id: `rv-${v.folio}`, tone: "danger", titulo: "Instalación requiere revisión", detalle: `${v.cliente.nombre} · ${v.folio}`, href: `/visitas/${v.folio}` });
  }
  for (const c of db.clientes.filter((x) => x.instaladoEn && !x.activadoEn && x.estado !== "CANCELADO")) {
    alertas.push({ id: `ac-${c.id}`, tone: "amber", titulo: "Instalado sin activar", detalle: `${c.nombre} · confirmar pulso`, href: `/clientes/${c.id}` });
  }
  for (const s of subs.filter((x) => x.estado === "pago_pendiente" && x.morosoDesde && daysBetween(x.morosoDesde, db.hoy) >= GRACIA_DIAS - 5)) {
    const c = db.clientes.find((x) => x.id === s.clienteId)!;
    alertas.push({ id: `mo-${s.id}`, tone: "amber", titulo: "Suspensión próxima por no pago", detalle: `${c.nombre} · ${daysBetween(s.morosoDesde!, db.hoy)} días de mora`, href: `/cobros?tab=morosidad` });
  }
  for (const t of db.tickets.filter((x) => x.nivel === "URGENTE" && x.estado !== "RESUELTO")) {
    const c = db.clientes.find((x) => x.id === t.clienteId)!;
    alertas.push({ id: `tk-${t.folio}`, tone: "danger", titulo: t.asunto, detalle: `${c.nombre} · ${t.folio}`, href: `/soporte?folio=${t.folio}` });
  }
  for (const p of db.pagos.filter((x) => x.estado === "pendiente")) {
    const c = db.clientes.find((x) => x.id === p.clienteId)!;
    alertas.push({ id: `pp-${p.id}`, tone: "muted", titulo: "Pago sin respuesta de la pasarela", detalle: `${c.nombre} · ${p.ordenFolio}`, href: `/ordenes?f=pendientes` });
  }
  for (const t of db.tecnicos.filter((x) => x.estado === "postulante" || x.estado === "en_validacion")) {
    alertas.push({ id: `te-${t.id}`, tone: "muted", titulo: "Técnico por validar", detalle: `${t.nombre} · ${t.documentos.filter((d) => d.estado === "pendiente").length} documentos pendientes`, href: `/tecnicos/${t.id}` });
  }

  return {
    hoy: db.hoy,
    periodo,
    rango: r,
    paso,
    ingresos: ing,
    ingresosAnterior: ingAnt,
    ventas: pagos,
    ventasAnterior: pagosAprob(r.antDesde, r.antHasta).length,
    clientesActivos: estados.ACTIVO,
    nuevasContrataciones: db.ordenes.filter((o) => entre(o.pagadaEn, r.desde, r.hasta)).length,
    estados,
    embudo: [
      { etapa: "Leads", valor: leads, href: "/ventas" },
      { etapa: "Checkouts iniciados", valor: checkouts, href: "/ordenes" },
      { etapa: "Pagos confirmados", valor: pagos, href: "/ordenes?f=pagadas" },
      { etapa: "Instalados", valor: instaladas, href: "/visitas?tab=cerradas" },
      { etapa: "Activados", valor: activaciones, href: "/clientes?estado=ACTIVO" },
    ],
    instalaciones: {
      pendientes: instalacion.filter((v) => v.grupo === "pendiente").length,
      agendadas: instalacion.filter((v) => v.grupo === "asignada" || v.grupo === "en_camino" || v.grupo === "en_proceso").length,
      completadas: instalacion.filter((v) => v.estado === "cerrada_ok" && entre(v.checkOutEn, r.desde, r.hasta)).length,
      revision: visitas.filter((v) => v.grupo === "revision").length,
    },
    suscripciones: {
      activas: subs.filter((s) => s.estado === "activa").length,
      renuevan: subs.filter((s) => s.estado === "activa" && s.proximoCobro && s.proximoCobro <= addDays(db.hoy, 30)).length,
      cobrosPendientes: morosas.length,
      montoPendiente: morosas.reduce((t, s) => t + s.montoPeriodo, 0),
      mrr: mrrDe(db),
    },
    tickets: {
      abiertos: db.tickets.filter((t) => t.estado !== "RESUELTO").length,
      urgentes: db.tickets.filter((t) => t.nivel === "URGENTE" && t.estado !== "RESUELTO").length,
      incidencias: visitas.filter((v) => v.estado === "fallida").length,
    },
    serie,
    hoyVisitas: visitas.filter((v) => v.fecha === db.hoy && v.estado !== "cancelada").sort((a, b) => (a.bloque ?? "").localeCompare(b.bloque ?? "")),
    alertas,
    actividad: [...db.eventos]
      .sort((a, b) => b.en.localeCompare(a.en))
      .slice(0, 14)
      .map((e) => ({ ...e, cliente: e.clienteId ? db.clientes.find((c) => c.id === e.clienteId) ?? null : null })),
  };
}
export type Resumen = ReturnType<typeof resumen>;

// ——— Finanzas ———

export function finanzas(db: Db, periodo: Periodo) {
  const r = rango(db.hoy, periodo);
  const ing = ingresos(db, r.desde, r.hasta);
  const ordenes = db.ordenes.filter((o) => entre(o.creadaEn, r.desde, r.hasta));
  const pagos = db.pagos.filter((p) => entre(p.creadoEn, r.desde, r.hasta));
  const cerradas = db.visitas.filter((v) => v.estado === "cerrada_ok" && entre(v.checkOutEn, r.desde, r.hasta));
  const costoInstalacion = cerradas.length * TARIFA_VISITA_DEMO;
  const { paso, out } = cortes(r.desde, r.hasta);

  // Conciliación simulada: un pago aprobado se liquida 2 días hábiles después (supuesto ilustrativo).
  const conciliacion = db.pagos
    .filter((p) => p.estado === "aprobado" || p.estado === "reembolsado")
    .filter((p) => entre(p.creadoEn, r.desde, r.hasta))
    .map((p) => {
      const liquidado = daysBetween(dia(p.creadoEn), db.hoy) >= 2;
      return {
        ...p,
        cliente: db.clientes.find((c) => c.id === p.clienteId)!.nombre,
        estadoConciliacion: p.estado === "reembolsado" ? ("reversado" as const) : liquidado ? ("conciliado" as const) : ("por_liquidar" as const),
        liquidacion: liquidado ? addDays(dia(p.creadoEn), 2) : null,
      };
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  return {
    hoy: db.hoy,
    rango: r,
    paso,
    ingresos: ing,
    ingresosAnterior: ingresos(db, r.antDesde, r.antHasta),
    costoInstalacion,
    instalaciones: cerradas.length,
    margen: ing.neto - costoInstalacion,
    mrr: mrrDe(db),
    ordenes: {
      creadas: ordenes.length,
      sinPago: ordenes.filter((o) => ["checkout_iniciado", "abandonada", "pendiente_pago", "pago_rechazado"].includes(o.estado)).length,
      montoSinPago: ordenes.filter((o) => ["checkout_iniciado", "abandonada", "pendiente_pago", "pago_rechazado"].includes(o.estado)).reduce((s, o) => s + o.montoTotal, 0),
    },
    pagos: {
      pendientes: pagos.filter((p) => p.estado === "pendiente"),
      /** Aprobados por la pasarela en el período, aunque después se hayan reembolsado (cuadra con los pagos iniciales). */
      confirmados: pagos.filter((p) => p.estado === "aprobado" || p.estado === "reembolsado").length,
      rechazados: pagos.filter((p) => p.estado === "rechazado").length,
      reembolsados: db.pagos.filter((p) => p.estado === "reembolsado" && entre(p.resueltoEn, r.desde, r.hasta)).length,
    },
    cobros: {
      aprobados: db.cobros.filter((c) => c.estado === "aprobado" && entre(c.fecha, r.desde, r.hasta)).length,
      rechazados: db.cobros.filter((c) => c.estado === "rechazado" && entre(c.fecha, r.desde, r.hasta)).length,
      porCobrar: db.suscripciones.filter((s) => s.estado === "pago_pendiente" || s.estado === "suspendida").reduce((t, s) => t + s.montoPeriodo, 0),
    },
    serie: out.map(({ ini, fin }) => {
      const x = ingresos(db, ini, fin);
      const costo = db.visitas.filter((v) => v.estado === "cerrada_ok" && entre(v.checkOutEn, ini, fin)).length * TARIFA_VISITA_DEMO;
      return { ini, fin, iniciales: x.iniciales, recurrentes: x.recurrentes, costo };
    }),
    conciliacion,
  };
}
export type Finanzas = ReturnType<typeof finanzas>;

/** Eventos generados por la demo, del más reciente al más antiguo. */
export function historialDemo(db: Db, limit = 30) {
  return db.eventos
    .filter((e) => e.demo)
    .slice(-limit)
    .reverse()
    .map((e) => ({ ...e, cliente: e.clienteId ? db.clientes.find((c) => c.id === e.clienteId)?.nombre ?? null : null }));
}
export type EventoDemo = ReturnType<typeof historialDemo>[number];

/** Eventos sin cliente (técnicos): para la bitácora general. */
export function eventosSistema(db: Db): Evento[] {
  return db.eventos.filter((e) => !e.clienteId).reverse();
}

/** Visitas de instalación aún sin agendar de un cliente. */
export function visitasPorAgendar(db: Db, clienteId: string): Visita[] {
  return db.visitas.filter((v) => v.clienteId === clienteId && ["por_agendar", "lista_espera", "requiere_persona"].includes(v.estado));
}
