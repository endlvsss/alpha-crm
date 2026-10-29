// Proveedor mock de los servicios: lee con las consultas puras y escribe con
// comandos del motor de dominio. Nada sale del navegador: ningún pago, mensaje,
// activación ni asignación se ejecuta de verdad.

import { CHECKLIST } from "@/data/seed";
import { ahoraSantiago, siguienteFolio, type Comando } from "@/lib/domain/engine";
import { bloquesDisponibles } from "@/lib/domain/agenda";
import type { Result, Services } from "../contracts";
import * as Q from "./queries";
import type { DemoStore } from "./store";
import { createIntegracion } from "./integracion";

export function createMockServices(store: DemoStore): Services {
  const db = () => store.getSnapshot().db;
  const ok = <T,>(data: T): Promise<Result<T>> => Promise.resolve({ ok: true, data });
  const err = (error: string): Promise<Result<never>> => Promise.resolve({ ok: false, error });
  const read = <T,>(fn: () => T) => Promise.resolve(fn());

  /** Ejecuta un comando con la hora actual de Santiago. */
  function run<T = void>(cmd: DistributiveOmit<Comando, "en">, data?: T): Promise<Result<T>> {
    const error = store.dispatch({ ...cmd, en: ahoraSantiago() } as Comando);
    return error ? err(error) : ok(data as T);
  }

  const nextId = (prefijo: string, ids: string[]) => `${prefijo}${String(ids.filter((x) => x.startsWith(prefijo)).length + 1).padStart(3, "0")}`;
  const folios = (prefijo: "ORD" | "VIS" | "TK", n = 1) => {
    const d = db();
    const existentes = prefijo === "ORD" ? d.ordenes.map((o) => o.folio) : prefijo === "VIS" ? d.visitas.map((v) => v.folio) : d.tickets.map((t) => t.folio);
    return siguienteFolio(existentes, prefijo, n);
  };
  const ordenAbierta = (clienteId: string) =>
    [...db().ordenes].reverse().find((o) => o.clienteId === clienteId && o.estado !== "cancelada" && o.estado !== "reembolsada");
  const refPago = () => `WP-DEMO-${String(Date.now()).slice(-8)}`;

  const services: Services = {
    customers: {
      list: (filter) => read(() => Q.listClientes(db(), filter)),
      get: (id) => read(() => Q.getCliente(db(), id)),
      team: () => read(() => db().usuarios),
      create: (datos) => {
        const id = nextId("cli-d", db().clientes.map((c) => c.id));
        return run({ tipo: "lead.crear", id, datos }, { id });
      },
      update: (id, cambios) => run({ tipo: "cliente.editar", clienteId: id, cambios }),
      addVehicle: (id, vehiculo) => run({ tipo: "vehiculo.agregar", clienteId: id, id: nextId("veh-d", db().vehiculos.map((v) => v.id)), vehiculo }),
      addNote: (id, texto) => run({ tipo: "nota.agregar", id: nextId("not-d", db().notas.map((n) => n.id)), clienteId: id, autorId: "usr-3", texto }),
    },

    pipeline: {
      board: (filter) => read(() => Q.tablero(db(), filter)),
      history: (limit) => read(() => Q.historialDemo(db(), limit)),
      advance: async (clienteId, input) => {
        const c = db().clientes.find((x) => x.id === clienteId);
        if (!c) return err("Cliente no encontrado");
        const etapa = Q.etapaCliente(db(), c);
        const o = ordenAbierta(clienteId);
        let r: Result<unknown>;
        switch (etapa) {
          case "nuevo_lead":
            if (!input?.planId || !input.billing) return err("Elige plan y periodicidad");
            r = await services.orders.startCheckout(clienteId, input.planId, input.billing);
            break;
          case "checkout_iniciado":
            r = await services.orders.sendToGateway(o!.folio);
            break;
          case "pendiente_pago":
            if (o!.estado === "pago_rechazado") {
              r = await services.orders.sendToGateway(o!.folio);
              if (!r.ok) break;
            }
            r = await services.orders.confirmPayment(o!.folio);
            break;
          case "pago_confirmado":
            r = await services.orders.createInstallationOrder(clienteId);
            break;
          case "instalacion_pendiente":
            return err("Elige día, bloque y técnico en el asistente de reserva");
          case "instalacion_agendada": {
            const v = db().visitas.find((x) => x.clienteId === clienteId && ["agendada", "confirmada", "en_camino", "en_sitio", "en_instalacion", "en_pruebas"].includes(x.estado));
            if (!v) return err("La visita tuvo una incidencia: crea o agenda una segunda visita");
            r = await services.installers.simulateInstallation(v.folio);
            break;
          }
          case "instalado":
            r = await services.devices.activate(clienteId);
            break;
          default:
            return err("El caso ya está activo o fuera del pipeline");
        }
        if (!r.ok) return r;
        const nuevo = db().clientes.find((x) => x.id === clienteId)!;
        return ok({ etapa: Q.etapaCliente(db(), nuevo) });
      },
    },

    orders: {
      list: () => read(() => Q.listOrdenes(db())),
      startCheckout: (clienteId, planId, periodicidad) => {
        const [folio] = folios("ORD");
        return run({ tipo: "checkout.iniciar", clienteId, folio, planId, periodicidad }, { folio });
      },
      sendToGateway: (folio) => run({ tipo: "pago.iniciar", folio, pagoId: nextId("pag-d", db().pagos.map((p) => p.id)) }),
      confirmPayment: (folio) => run({ tipo: "pago.confirmar", folio, ref: refPago() }),
      rejectPayment: (folio) => run({ tipo: "pago.rechazar", folio }),
      refund: (folio, motivo) => run({ tipo: "pago.reembolsar", folio, motivo }),
      createInstallationOrder: (clienteId) => {
        const n = db().vehiculos.filter((v) => v.clienteId === clienteId).length || 1;
        const fs = folios("VIS", n);
        return run({ tipo: "instalacion.crear", clienteId, folios: fs }, { folios: fs });
      },
    },

    installers: {
      list: () => read(() => Q.listTecnicos(db())),
      get: (id) => read(() => Q.getTecnico(db(), id)),
      apply: (datos) => {
        const id = nextId("tec-d", db().tecnicos.map((t) => t.id));
        return run({ tipo: "tecnico.postular", id, datos }, { id });
      },
      setStatus: (id, estado) => run({ tipo: "tecnico.estado", tecnicoId: id, estado }),
      reviewDocument: (id, documento, estado) => run({ tipo: "tecnico.documento", tecnicoId: id, documento, estado }),
      update: (id, data) => run({ tipo: "tecnico.editar", tecnicoId: id, ...data }),
      appointments: () => read(() => Q.listVisitas(db())),
      appointment: (folio) => read(() => Q.getVisita(db(), folio)),
      calendar: (desde, dias) => read(() => Q.calendario(db(), desde, dias)),
      availableSlots: (folio) =>
        read(() => {
          const v = db().visitas.find((x) => x.folio === folio);
          return v ? bloquesDisponibles(db(), v.comuna, folio) : [];
        }),
      book: (folio, tecnicoId, fecha, bloque) => run({ tipo: "visita.reservar", folio, tecnicoId, fecha, bloque }),
      advance: (folio, estado) => run({ tipo: "visita.avanzar", folio, estado }),
      toggleChecklist: (folio, item, hecho) => run({ tipo: "visita.checklist", folio, item, hecho }),
      addPhoto: (folio) => run({ tipo: "visita.foto", folio }),
      saveNotes: (folio, texto) => run({ tipo: "visita.observaciones", folio, texto }),
      complete: (folio, imeiGps, imeiTag) => run({ tipo: "visita.cerrar", folio, imeiGps, imeiTag }),
      fail: (folio, causa) => run({ tipo: "visita.fallar", folio, causa, ticketFolio: folios("TK")[0] }),
      cancel: (folio, motivo) => run({ tipo: "visita.cancelar", folio, motivo }),
      simulateInstallation: async (folio) => {
        const pasos: (() => Promise<Result>)[] = [];
        const v = () => db().visitas.find((x) => x.folio === folio)!;
        if (!v()) return err("Visita no encontrada");
        if (["agendada", "confirmada"].includes(v().estado)) pasos.push(() => services.installers.advance(folio, "en_camino"));
        if (["agendada", "confirmada", "en_camino", "en_sitio"].includes(v().estado)) pasos.push(() => services.installers.advance(folio, "en_instalacion"));
        for (const p of pasos) {
          const r = await p();
          if (!r.ok) return r;
        }
        const plan = db().suscripciones.find((s) => s.vehiculoId === v().vehiculoId)?.planId;
        for (const item of CHECKLIST.filter((x) => x.id !== "rele" || plan !== "esencial")) {
          if (!v().checklist.includes(item.id)) {
            const r = await services.installers.toggleChecklist(folio, item.id, true);
            if (!r.ok) return r;
          }
        }
        while (v().fotos < 5) {
          const r = await services.installers.addPhoto(folio);
          if (!r.ok) return r;
        }
        if (v().estado === "en_instalacion") {
          const r = await services.installers.advance(folio, "en_pruebas");
          if (!r.ok) return r;
        }
        const gps = (await services.devices.available("gps", v().tecnicoId))[0];
        const tag = plan && plan !== "esencial" ? (await services.devices.available("tag", v().tecnicoId))[0] : null;
        if (!gps) return err("No hay GPS disponibles en bodega ni en custodia del técnico");
        if (plan !== "esencial" && !tag) return err("No hay TAG de respaldo disponibles");
        return services.installers.complete(folio, gps.imei, tag?.imei ?? null);
      },
    },

    devices: {
      list: () => read(() => Q.listDispositivos(db())),
      available: (tipo, tecnicoId) =>
        read(() =>
          db()
            .dispositivos.filter((d) => d.tipo === tipo && (d.estado === "en_stock" || (d.estado === "asignado" && (!tecnicoId || d.custodiaTecnicoId === tecnicoId))))
            .sort((a, b) => Number(b.custodiaTecnicoId === tecnicoId) - Number(a.custodiaTecnicoId === tecnicoId)),
        ),
      activate: (clienteId) => run({ tipo: "activacion.confirmar", clienteId }),
    },

    billing: {
      subscriptions: () => read(() => Q.listSuscripciones(db())),
      cancelSubscription: (id, motivo) => run({ tipo: "suscripcion.cancelar", id, motivo }),
      retryCharge: (id, aprobado) => run({ tipo: "cobro.reintentar", suscripcionId: id, aprobado }),
      finance: (periodo) => read(() => Q.finanzas(db(), periodo)),
    },

    support: {
      list: () => read(() => Q.listTickets(db())),
      create: (d) => {
        const [folio] = folios("TK");
        return run(
          { tipo: "ticket.crear", folio, clienteId: d.customerId, vehiculoId: d.vehicleId, asunto: d.subject, detalle: d.detail, nivel: d.level, origen: d.origin, responsableId: d.assigneeId },
          { folio },
        );
      },
      setStatus: (folio, estado) => run({ tipo: "ticket.estado", folio, estado }),
      assign: (folio, responsableId) => run({ tipo: "ticket.asignar", folio, responsableId }),
    },

    integration: createIntegracion(store, () => services),

    dashboard: {
      summary: (periodo) => read(() => Q.resumen(db(), periodo)),
      today: () => read(() => db().hoy),
    },
  };
  return services;
}

/** Omit que respeta las uniones (cada variante de Comando pierde «en»). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
