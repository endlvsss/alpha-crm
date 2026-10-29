// Integración de DEMO con el sitio y el portal del técnico. Cada evento recibido
// se traduce a los mismos comandos que usa el resto del CRM, paso a paso, y queda
// registrado en la bandeja de entrada con su id para no aplicarlo dos veces.

import { BLOQUE_FIN, CHECKLIST } from "@/data/seed";
import { ahoraSantiago, siguienteFolio, type Comando } from "@/lib/domain/engine";
import { motivoNoDisponible } from "@/lib/domain/agenda";
import { formatRut, normalizeRut } from "@/lib/rut";
import { nuevoEvento, RUT_TECNICO_PORTAL, type Evento } from "../eventos";
import type { IntegrationService, PasoIntegracion, Result, Services } from "../contracts";
import type { DemoStore } from "./store";

type SinFecha = Comando extends infer C ? (C extends unknown ? Omit<C, "en"> : never) : never;

const ACTIVAS = ["agendada", "confirmada", "en_camino", "en_sitio", "en_instalacion", "en_pruebas"];

/** «9 8765 4321» o «987654321» → «+56 9 8765 4321». */
function telefonoChile(t: string): string {
  const d = t.replace(/\D/g, "").replace(/^56/, "");
  return /^9\d{8}$/.test(d) ? `+56 ${d[0]} ${d.slice(1, 5)} ${d.slice(5)}` : t;
}

const patenteNorm = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function createIntegracion(store: DemoStore, services: () => Services): IntegrationService {
  const db = () => store.getSnapshot().db;

  function run(cmd: SinFecha): string | null {
    return store.dispatch({ ...cmd, en: ahoraSantiago() } as Comando);
  }

  async function compra(ev: Extract<Evento, { tipo: "sitio.compra" }>, pasos: PasoIntegracion[]) {
    const d = ev.datos;
    const s = services();
    const paso = (label: string, error: string | null, detalle?: string) =>
      pasos.push(error ? { label, estado: "aviso", detalle: error } : { label, estado: "ok", detalle });

    let c = db().clientes.find((x) => normalizeRut(x.rut) === normalizeRut(d.cliente.rut));
    if (!c) {
      const [primero, ...resto] = d.vehiculos.filter((v) => v.patente);
      const r = await s.customers.create({
        nombre: d.cliente.nombre,
        rut: formatRut(d.cliente.rut),
        email: d.cliente.email,
        telefono: telefonoChile(d.cliente.telefono),
        comuna: d.direccion.comuna,
        direccion: [d.direccion.calle, d.direccion.detalle].filter(Boolean).join(", "),
        origen: "organico",
        responsableId: "usr-1",
        consentimientoMarketing: d.consentimientoMarketing,
        vehiculo: primero ? { patente: primero.patente, marca: primero.marca, modelo: primero.modelo, anio: Number(primero.anio) || 2020, color: "" } : null,
      });
      if (!r.ok) {
        paso("Crear el lead", r.error);
        return null;
      }
      paso("Lead creado desde la landing", null, `${d.cliente.nombre} · ${d.direccion.comuna}`);
      for (const v of resto) {
        const rv = await s.customers.addVehicle(r.data.id, { patente: v.patente, marca: v.marca, modelo: v.modelo, anio: Number(v.anio) || 2020, color: "" });
        paso(`Vehículo ${v.patente}`, rv.ok ? null : rv.error);
      }
      c = db().clientes.find((x) => x.id === r.data.id)!;
    } else {
      pasos.push({ label: "El cliente ya existía (mismo RUT): se completa lo que falte", estado: "omitido" });
    }
    const id = c.id;

    if (db().clientes.find((x) => x.id === id)!.estado === "LEAD" && d.orden) {
      let orden = [...db().ordenes].reverse().find((o) => o.clienteId === id && !["cancelada", "reembolsada", "abandonada"].includes(o.estado));
      if (!orden) {
        const r = await s.orders.startCheckout(id, d.plan, d.periodicidad);
        paso("Checkout iniciado", r.ok ? null : r.error, `${d.plan} · ${d.periodicidad} · folio del sitio ${d.orden.folio}`);
        if (!r.ok) return id;
        orden = db().ordenes.find((o) => o.folio === r.data.folio)!;
      }
      if (orden.estado !== "pendiente_pago") {
        const r = await s.orders.sendToGateway(orden.folio);
        if (!r.ok) paso("Enviar a la pasarela", r.error);
      }
      if (d.orden.estado === "pagada") {
        paso("Pago confirmado", run({ tipo: "pago.confirmar", folio: orden.folio, ref: `WEB-${d.orden.folio}` }), "Pasarela simulada del sitio");
      } else if (d.orden.estado === "rechazada") {
        paso("Pago rechazado", run({ tipo: "pago.rechazar", folio: orden.folio }));
      } else {
        pasos.push({ label: "Pago pendiente en la pasarela", estado: "omitido" });
      }
    }

    const cliente = db().clientes.find((x) => x.id === id)!;
    const conVisita = () => db().visitas.filter((v) => v.clienteId === id && v.tipo === "instalacion" && v.estado !== "cancelada");
    if (cliente.estado === "PAGADO" && conVisita().length === 0) {
      const r = await s.orders.createInstallationOrder(id);
      paso("Orden de instalación creada", r.ok ? null : r.error, r.ok ? r.data.folios.join(", ") : undefined);
    }

    const porAgendar = conVisita().find((v) => ["por_agendar", "lista_espera", "requiere_persona"].includes(v.estado));
    if (d.reserva && porAgendar) {
      const { fecha, bloque, tecnicoRut } = d.reserva;
      const tec = tecnicoRut ? db().tecnicos.find((t) => normalizeRut(t.rut) === normalizeRut(tecnicoRut)) : undefined;
      if (tec) {
        const error = run({ tipo: "visita.reservarExterna", folio: porAgendar.folio, tecnicoId: tec.id, fecha, bloque, origen: `reservada en el sitio (${d.reserva.folio})` });
        paso(`Reserva ${fecha} · ${bloque} con ${tec.nombre}`, error ? `${error}. La visita queda por agendar para que Operaciones la reasigne.` : null);
      } else {
        // Disponibilidad ficticia en el sitio: se busca un técnico compatible en el CRM.
        const libre = db().tecnicos.find((t) => motivoNoDisponible(db(), t, porAgendar.comuna, fecha, bloque, porAgendar.folio) === null);
        if (libre) paso(`Reserva ${fecha} · ${bloque} con ${libre.nombre}`, run({ tipo: "visita.reservar", folio: porAgendar.folio, tecnicoId: libre.id, fecha, bloque }));
        else pasos.push({ label: "Reserva del sitio", estado: "aviso", detalle: `Ningún técnico del CRM cubre ${porAgendar.comuna} en ese bloque: queda por agendar.` });
      }
    } else if (d.listaEspera && porAgendar) {
      pasos.push({ label: "Lista de espera en el sitio", estado: "aviso", detalle: "La visita queda por agendar en el CRM." });
    }
    return id;
  }

  async function resultado(ev: Extract<Evento, { tipo: "portal.visita" }>, pasos: PasoIntegracion[]) {
    const d = ev.datos;
    const s = services();
    const veh = db().vehiculos.find((v) => v.patente === patenteNorm(d.patente) && v.estado !== "baja");
    if (!veh) {
      pasos.push({ label: "Buscar el vehículo", estado: "aviso", detalle: `La patente ${d.patente} no está en el CRM. Envía primero la compra desde el sitio.` });
      return { clienteId: null, folio: null };
    }
    const visitas = db().visitas.filter((v) => v.vehiculoId === veh.id && ACTIVAS.includes(v.estado));
    const v = visitas.at(-1);
    if (!v) {
      const cerrada = db().visitas.some((x) => x.vehiculoId === veh.id && x.estado === "cerrada_ok");
      pasos.push({ label: "Buscar la visita", estado: "aviso", detalle: cerrada ? "La visita de ese vehículo ya está cerrada en el CRM." : "No hay una visita agendada para ese vehículo en el CRM." });
      return { clienteId: veh.clienteId, folio: null };
    }
    const tec = db().tecnicos.find((t) => normalizeRut(t.rut) === normalizeRut(d.tecnicoRut));
    if (tec && v.tecnicoId !== tec.id) pasos.push({ label: "Técnico distinto", estado: "aviso", detalle: `En el CRM la visita estaba asignada a otro técnico; la cerró ${tec.nombre}.` });

    const estado = () => db().visitas.find((x) => x.folio === v.folio)!.estado;
    if (["agendada", "confirmada"].includes(estado())) run({ tipo: "visita.avanzar", folio: v.folio, estado: "en_camino" });
    if (["en_camino", "en_sitio"].includes(estado())) run({ tipo: "visita.avanzar", folio: v.folio, estado: "en_instalacion" });
    pasos.push({ label: "Check-in registrado", estado: "ok", detalle: `${v.folio} · portal ${d.folioPortal}` });

    if (d.resultado === "fallida") {
      const [tk] = siguienteFolio(db().tickets.map((t) => t.folio), "TK");
      if (d.descripcion) run({ tipo: "visita.observaciones", folio: v.folio, texto: d.descripcion });
      const error = run({ tipo: "visita.fallar", folio: v.folio, causa: d.causa ?? "otro", ticketFolio: tk });
      pasos.push(error ? { label: "Registrar la falla", estado: "aviso", detalle: error } : { label: `Instalación fallida · ticket ${tk}`, estado: "ok", detalle: "Queda en «Requiere revisión»" });
      return { clienteId: v.clienteId, folio: v.folio };
    }

    if (d.imeiGps && !db().dispositivos.some((x) => x.imei === d.imeiGps)) {
      const error = run({ tipo: "dispositivo.alta", imei: d.imeiGps, dispositivo: "gps", custodiaTecnicoId: tec?.id ?? v.tecnicoId, origen: "IMEI informado desde el portal del técnico" });
      pasos.push(error ? { label: "Alta del IMEI", estado: "aviso", detalle: error } : { label: `IMEI ${d.imeiGps} dado de alta en el inventario`, estado: "ok" });
    }
    const plan = db().suscripciones.find((x) => x.vehiculoId === veh.id)?.planId;
    for (const item of CHECKLIST.filter((x) => x.id !== "rele" || plan !== "esencial")) run({ tipo: "visita.checklist", folio: v.folio, item: item.id, hecho: true });
    for (let i = db().visitas.find((x) => x.folio === v.folio)!.fotos; i < Math.min(12, Math.max(3, d.fotos)); i++) run({ tipo: "visita.foto", folio: v.folio });
    if (estado() === "en_instalacion") run({ tipo: "visita.avanzar", folio: v.folio, estado: "en_pruebas" });
    pasos.push({ label: `Checklist y evidencia`, estado: "ok", detalle: `${d.checklistOk}/${d.checklistTotal} ítems en el portal · ${d.fotos} fotos · ${d.firma ? "con firma" : "sin firma"}` });

    const gps = d.imeiGps ?? (await s.devices.available("gps", v.tecnicoId))[0]?.imei;
    const tag = plan && plan !== "esencial" ? (await s.devices.available("tag", v.tecnicoId))[0]?.imei ?? null : null;
    if (plan && plan !== "esencial") pasos.push({ label: "TAG de respaldo", estado: tag ? "ok" : "aviso", detalle: tag ? `${tag} desde el inventario (el portal aún no registra el IMEI del TAG)` : "No hay TAG disponibles" });
    const error = gps ? run({ tipo: "visita.cerrar", folio: v.folio, imeiGps: gps, imeiTag: tag }) : "Falta el IMEI del GPS";
    pasos.push(error ? { label: "Cerrar la instalación", estado: "aviso", detalle: error } : { label: "INSTALADO · visita completada", estado: "ok" });
    if (!error) pasos.push({ label: "Activación pendiente", estado: "aviso", detalle: "Confírmala en el CRM: sin API de la plataforma GPS, la verifica una persona." });
    return { clienteId: v.clienteId, folio: v.folio };
  }

  return {
    inbox: () => Promise.resolve([...db().entradas].reverse()),
    applied: (id) => Promise.resolve(db().entradas.find((e) => e.id === id) ?? null),

    receive: async (ev): Promise<Result<{ pasos: PasoIntegracion[]; clienteId: string | null; visitaFolio: string | null }>> => {
      const previo = db().entradas.find((e) => e.id === ev.id);
      if (previo) return { ok: false, error: `Este evento ya se aplicó (${previo.resumen}).` };
      if (ev.tipo === "crm.visita") return { ok: false, error: "Este evento va hacia el portal del técnico, no hacia el CRM." };
      const pasos: PasoIntegracion[] = [];
      let clienteId: string | null = null;
      let visitaFolio: string | null = null;
      if (ev.tipo === "sitio.compra") {
        clienteId = await compra(ev, pasos);
        visitaFolio = clienteId ? db().visitas.filter((v) => v.clienteId === clienteId).at(-1)?.folio ?? null : null;
      } else {
        const r = await resultado(ev, pasos);
        clienteId = r.clienteId;
        visitaFolio = r.folio;
      }
      const aplicado = pasos.some((p) => p.estado === "ok");
      if (aplicado) {
        const resumen = ev.tipo === "sitio.compra" ? `Compra de ${ev.datos.cliente.nombre}` : `Visita ${ev.datos.patente} · ${ev.datos.resultado === "fallida" ? "fallida" : "cerrada"}`;
        run({ tipo: "integracion.registrar", eventoId: ev.id, evento: ev.tipo, origen: ev.tipo === "sitio.compra" ? "sitio" : "portal", resumen, clienteId });
      }
      return { ok: true, data: { pasos, clienteId, visitaFolio } };
    },

    visitForPortal: async (folio) => {
      const v = db().visitas.find((x) => x.folio === folio);
      if (!v) return { ok: false, error: "Visita no encontrada" };
      const t = db().tecnicos.find((x) => x.id === v.tecnicoId);
      if (!t || normalizeRut(t.rut) !== normalizeRut(RUT_TECNICO_PORTAL)) {
        return { ok: false, error: "El portal de demo solo tiene a Diego Fuentes: asígnale la visita para enviarla." };
      }
      if (!v.fecha || !v.bloque) return { ok: false, error: "La visita aún no tiene día y bloque" };
      const c = db().clientes.find((x) => x.id === v.clienteId)!;
      const veh = db().vehiculos.find((x) => x.id === v.vehiculoId)!;
      const plan = db().suscripciones.find((x) => x.vehiculoId === veh.id)?.planId ?? db().ordenes.find((o) => o.clienteId === c.id)?.planId ?? "seguridad";
      return {
        ok: true,
        data: nuevoEvento("crm.visita", {
          folio: v.folio,
          tipo: v.tipo,
          fecha: v.fecha,
          bloque: v.bloque,
          fin: BLOQUE_FIN[v.bloque],
          cliente: { nombre: c.nombre, telefono: c.telefono },
          direccion: { calle: c.direccion, detalle: "", comuna: v.comuna, indicaciones: "" },
          vehiculo: { patente: veh.patente, marca: veh.marca, modelo: veh.modelo, anio: String(veh.anio), color: veh.color },
          plan,
          tecnicoRut: t.rut,
          notas: v.observaciones ?? "Asignada por Operaciones en el CRM.",
        }),
      };
    },
  };
}
