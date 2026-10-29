// Motor de la demo: aplica comandos sobre los datos ficticios y valida las reglas
// del blueprint. Es código de dominio puro (sin React ni almacenamiento): el
// mismo contrato servirá para validar en el servidor cuando exista la API.
//
// Cada comando deja eventos en la bitácora marcados como demo. El estado del
// cliente se fija aquí, como consecuencia del evento, nunca a mano (D7).

import type { Db } from "@/data/seed";
import { addDays, CHECKLIST } from "@/data/seed";
import type { IsoDate } from "@/lib/format";
import { getPlan, quote, type Billing, type PlanId } from "@/lib/plans";
import { isValidRut } from "@/lib/rut";
import { motivoNoDisponible, MOTIVO_NO_DISPONIBLE } from "./agenda";
import type {
  CausaFalla,
  Cliente,
  DocumentoTecnico,
  EstadoTecnico,
  EstadoTicket,
  Evento,
  Iso,
  Nivel,
  OrigenTicket,
  Origen,
  Tecnico,
  Vehiculo,
  Visita,
} from "./types";

export interface DatosVehiculo {
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
}

export interface DatosLead {
  nombre: string;
  rut: string;
  email: string;
  telefono: string;
  comuna: string;
  direccion: string;
  origen: Origen;
  responsableId: string;
  consentimientoMarketing: boolean;
  vehiculo: DatosVehiculo | null;
}

export interface DatosTecnico {
  nombre: string;
  rut: string;
  email: string;
  telefono: string;
  comunas: string[];
  experienciaAnios: number;
  especialidades: string[];
  disponibilidad: Record<number, string[]>;
}

export type CambiosCliente = Partial<
  Pick<Cliente, "nombre" | "email" | "telefono" | "direccion" | "comuna" | "responsableId" | "consentimientoMarketing">
>;

type Base = { en: Iso };

export type Comando = Base &
  (
    | { tipo: "lead.crear"; id: string; datos: DatosLead }
    | { tipo: "cliente.editar"; clienteId: string; cambios: CambiosCliente }
    | { tipo: "vehiculo.agregar"; clienteId: string; id: string; vehiculo: DatosVehiculo }
    | { tipo: "nota.agregar"; id: string; clienteId: string; autorId: string; texto: string }
    | { tipo: "checkout.iniciar"; clienteId: string; folio: string; planId: PlanId; periodicidad: Billing }
    | { tipo: "pago.iniciar"; folio: string; pagoId: string }
    | { tipo: "pago.confirmar"; folio: string; ref: string }
    | { tipo: "pago.rechazar"; folio: string }
    | { tipo: "pago.reembolsar"; folio: string; motivo: string }
    | { tipo: "instalacion.crear"; clienteId: string; folios: string[] }
    | { tipo: "visita.reservar"; folio: string; tecnicoId: string; fecha: IsoDate; bloque: string }
    | { tipo: "visita.avanzar"; folio: string; estado: "confirmada" | "en_camino" | "en_instalacion" | "en_pruebas" }
    | { tipo: "visita.checklist"; folio: string; item: string; hecho: boolean }
    | { tipo: "visita.foto"; folio: string }
    | { tipo: "visita.observaciones"; folio: string; texto: string }
    | { tipo: "visita.cerrar"; folio: string; imeiGps: string; imeiTag: string | null }
    | { tipo: "visita.fallar"; folio: string; causa: CausaFalla; ticketFolio: string }
    | { tipo: "visita.cancelar"; folio: string; motivo: string }
    | { tipo: "activacion.confirmar"; clienteId: string }
    | { tipo: "tecnico.postular"; id: string; datos: DatosTecnico }
    | { tipo: "tecnico.estado"; tecnicoId: string; estado: EstadoTecnico }
    | { tipo: "tecnico.documento"; tecnicoId: string; documento: DocumentoTecnico["tipo"]; estado: DocumentoTecnico["estado"] }
    | { tipo: "tecnico.editar"; tecnicoId: string; cupoDiario: number; comunas: string[]; disponibilidad: Record<number, string[]> }
    | { tipo: "ticket.crear"; folio: string; clienteId: string; vehiculoId: string | null; asunto: string; detalle: string; nivel: Nivel; origen: OrigenTicket; responsableId: string | null }
    | { tipo: "ticket.estado"; folio: string; estado: EstadoTicket }
    | { tipo: "ticket.asignar"; folio: string; responsableId: string | null }
    | { tipo: "suscripcion.cancelar"; id: string; motivo: string }
    | { tipo: "cobro.reintentar"; suscripcionId: string; aprobado: boolean }
    | { tipo: "dispositivo.alta"; imei: string; dispositivo: "gps" | "tag"; custodiaTecnicoId: string | null; origen: string }
    | { tipo: "visita.reservarExterna"; folio: string; tecnicoId: string; fecha: IsoDate; bloque: string; origen: string }
    | { tipo: "integracion.registrar"; eventoId: string; evento: string; origen: "sitio" | "portal"; resumen: string; clienteId: string | null }
  );

export type TipoComando = Comando["tipo"];

/** Error de validación: el comando no se aplica y la pantalla muestra el mensaje. */
export class ReglaError extends Error {}

function fail(msg: string): never {
  throw new ReglaError(msg);
}

/** Aplica un comando sobre db (lo modifica). Lanza ReglaError si no corresponde. */
export function aplicar(db: Db, cmd: Comando): void {
  const ev = (clienteId: string | null, entidad: Evento["entidad"], entidadRef: string, tipo: string, detalle: string | null, actor: Evento["actor"] = "operaciones") => {
    db.eventos.push({ id: `ev-d${String(db.eventos.length + 1).padStart(5, "0")}`, clienteId, entidad, entidadRef, tipo, detalle, actor, en: cmd.en, demo: true });
  };
  const cliente = (id: string) => db.clientes.find((c) => c.id === id) ?? fail("Cliente no encontrado");
  const orden = (folio: string) => db.ordenes.find((o) => o.folio === folio) ?? fail("Orden no encontrada");
  const visita = (folio: string) => db.visitas.find((v) => v.folio === folio) ?? fail("Visita no encontrada");
  const tecnico = (id: string) => db.tecnicos.find((t) => t.id === id) ?? fail("Técnico no encontrado");
  const ticket = (folio: string) => db.tickets.find((t) => t.folio === folio) ?? fail("Ticket no encontrado");

  switch (cmd.tipo) {
    case "lead.crear": {
      const d = cmd.datos;
      validarPersona(d.nombre, d.rut, d.email, d.telefono);
      if (!d.comuna) fail("Elige la comuna");
      if (db.clientes.some((c) => c.rut === d.rut)) fail("Ya existe un cliente con ese RUT");
      if (d.vehiculo) validarVehiculo(db, d.vehiculo);
      const c: Cliente = {
        id: cmd.id,
        nombre: d.nombre.trim(),
        rut: d.rut,
        email: d.email.trim().toLowerCase(),
        telefono: d.telefono.trim(),
        comuna: d.comuna,
        direccion: d.direccion.trim(),
        estado: "LEAD",
        subestado: "INTERESADO",
        origen: d.origen,
        campana: null,
        consentimientoMarketing: d.consentimientoMarketing,
        creadoEn: cmd.en,
        cuentaCreadaEn: null,
        instaladoEn: null,
        activadoEn: null,
        motivoBaja: null,
        responsableId: d.responsableId,
      };
      db.clientes.push(c);
      if (d.vehiculo) db.vehiculos.push(nuevoVehiculo(`${cmd.id}-v1`, c.id, d.vehiculo));
      ev(c.id, "cliente", c.id, "LEAD", `Creado por Operaciones · ${d.origen}`);
      return;
    }

    case "cliente.editar": {
      const c = cliente(cmd.clienteId);
      const x = cmd.cambios;
      if (x.nombre !== undefined && x.nombre.trim().length < 3) fail("El nombre es muy corto");
      if (x.email !== undefined && !EMAIL.test(x.email)) fail("Correo no válido");
      if (x.telefono !== undefined && !TELEFONO.test(x.telefono.replace(/\s/g, ""))) fail("Teléfono no válido: usa +56 9 XXXX XXXX");
      const cambiados = (Object.keys(x) as (keyof CambiosCliente)[]).filter((k) => x[k] !== undefined && x[k] !== c[k]);
      if (cambiados.length === 0) fail("No hay cambios que guardar");
      Object.assign(c, x);
      ev(c.id, "cliente", c.id, "Datos actualizados", cambiados.map((k) => CAMPO[k]).join(", "));
      return;
    }

    case "vehiculo.agregar": {
      const c = cliente(cmd.clienteId);
      if (c.estado !== "LEAD") fail("Solo se agregan vehículos antes de pagar; después es un segundo vehículo (POR DEFINIR)");
      validarVehiculo(db, cmd.vehiculo);
      db.vehiculos.push(nuevoVehiculo(cmd.id, c.id, cmd.vehiculo));
      ev(c.id, "cliente", c.id, "Vehículo agregado", cmd.vehiculo.patente.toUpperCase());
      return;
    }

    case "nota.agregar": {
      cliente(cmd.clienteId);
      if (cmd.texto.trim().length < 3) fail("Escribe la nota");
      db.notas.push({ id: cmd.id, clienteId: cmd.clienteId, autorId: cmd.autorId, texto: cmd.texto.trim(), en: cmd.en });
      return;
    }

    case "checkout.iniciar": {
      const c = cliente(cmd.clienteId);
      if (c.estado !== "LEAD") fail("El cliente ya pagó");
      const abierta = db.ordenes.find((o) => o.clienteId === c.id && ["checkout_iniciado", "pendiente_pago", "pago_rechazado"].includes(o.estado));
      if (abierta) fail(`Ya tiene la orden ${abierta.folio} abierta`);
      const plan = getPlan(cmd.planId);
      const vehiculos = db.vehiculos.filter((v) => v.clienteId === c.id).length;
      if (vehiculos === 0) fail("Registra al menos un vehículo antes del checkout");
      if (vehiculos < plan.minVehicles) fail(`El plan ${plan.name} requiere ${plan.minVehicles} vehículos o más (tiene ${vehiculos})`);
      if (vehiculos > plan.maxVehicles) fail(`El plan ${plan.name} cubre hasta ${plan.maxVehicles} vehículo${plan.maxVehicles > 1 ? "s" : ""}; elige Flota`);
      // Una orden abandonada antes se reemplaza: queda en el historial.
      db.ordenes.push({
        folio: cmd.folio,
        clienteId: c.id,
        planId: plan.id,
        periodicidad: cmd.periodicidad,
        vehiculos,
        estado: "checkout_iniciado",
        montoTotal: quote(plan, cmd.periodicidad, vehiculos).dueToday,
        pasarela: "webpay",
        pagoRef: null,
        creadaEn: cmd.en,
        pagadaEn: null,
      });
      c.subestado = "CHECKOUT INICIADO";
      ev(c.id, "orden", cmd.folio, "CHECKOUT INICIADO", `${plan.name} · ${cmd.periodicidad} · ${vehiculos} vehículo${vehiculos > 1 ? "s" : ""}`);
      return;
    }

    case "pago.iniciar": {
      const o = orden(cmd.folio);
      if (!["checkout_iniciado", "abandonada", "pago_rechazado"].includes(o.estado)) fail("La orden no está esperando pago");
      o.estado = "pendiente_pago";
      db.pagos.push({ id: cmd.pagoId, ordenFolio: o.folio, clienteId: o.clienteId, monto: o.montoTotal, pasarela: o.pasarela, estado: "pendiente", ref: null, motivo: null, creadoEn: cmd.en, resueltoEn: null });
      ev(o.clienteId, "orden", o.folio, "Redirigido a la pasarela", "Webpay simulado · esperando respuesta", "cliente");
      return;
    }

    case "pago.confirmar":
    case "pago.rechazar": {
      const o = orden(cmd.folio);
      const p = db.pagos.find((x) => x.ordenFolio === o.folio && x.estado === "pendiente");
      if (o.estado !== "pendiente_pago" || !p) fail("No hay un pago pendiente para esta orden");
      const c = cliente(o.clienteId);
      p.resueltoEn = cmd.en;
      if (cmd.tipo === "pago.rechazar") {
        p.estado = "rechazado";
        p.motivo = "Rechazado por el emisor (simulado)";
        o.estado = "pago_rechazado";
        ev(c.id, "orden", o.folio, "Pago rechazado", "Se invita a reintentar", "sistema");
        return;
      }
      p.estado = "aprobado";
      p.ref = cmd.ref;
      o.estado = "pagada";
      o.pagadaEn = cmd.en;
      o.pagoRef = cmd.ref;
      c.estado = "PAGADO";
      c.subestado = null;
      c.cuentaCreadaEn = cmd.en;
      if (!db.cuentas.some((x) => x.clienteId === c.id)) {
        db.cuentas.push({ clienteId: c.id, estadoUsuario: "pendiente", invitadoEn: cmd.en, ultimoIngreso: null });
      }
      const plan = getPlan(o.planId);
      db.vehiculos
        .filter((v) => v.clienteId === c.id)
        .forEach((v, k) => {
          db.suscripciones.push({
            id: `sus-${c.id}-${k + 1}`,
            clienteId: c.id,
            vehiculoId: v.id,
            planId: o.planId,
            periodicidad: o.periodicidad,
            estado: "pendiente_instalacion",
            montoPeriodo: o.periodicidad === "anual" ? plan.monthly * 10 : plan.monthly,
            inicio: null,
            proximoCobro: null,
            morosoDesde: null,
          });
        });
      ev(c.id, "orden", o.folio, "PAGADO", `Webpay simulado ${cmd.ref}`, "sistema");
      ev(c.id, "plataforma", c.id, "CUENTA CREADA", "Invitación a GPSTracker simulada (no se envió nada)", "sistema");
      return;
    }

    case "pago.reembolsar": {
      const o = orden(cmd.folio);
      const c = cliente(o.clienteId);
      if (o.estado !== "pagada") fail("Solo se reembolsa una orden pagada");
      if (c.instaladoEn) fail("Ya hay instalación: corresponde una baja, no un reembolso");
      const p = db.pagos.find((x) => x.ordenFolio === o.folio && x.estado === "aprobado");
      if (p) {
        p.estado = "reembolsado";
        p.motivo = cmd.motivo;
        p.resueltoEn = cmd.en;
      }
      o.estado = "reembolsada";
      c.estado = "CANCELADO";
      c.subestado = null;
      c.motivoBaja = cmd.motivo;
      db.suscripciones.filter((s) => s.clienteId === c.id).forEach((s) => (s.estado = "cancelada"));
      db.visitas.filter((v) => v.clienteId === c.id && v.estado !== "cerrada_ok").forEach((v) => (v.estado = "cancelada"));
      const cuenta = db.cuentas.find((x) => x.clienteId === c.id);
      if (cuenta) cuenta.estadoUsuario = "bloqueado";
      ev(c.id, "orden", o.folio, "Reembolso", `${cmd.motivo} · simulado, sin movimiento real`);
      ev(c.id, "cliente", c.id, "CANCELADO", "Antes de la instalación");
      return;
    }

    case "instalacion.crear": {
      const c = cliente(cmd.clienteId);
      if (c.estado !== "PAGADO") fail("Primero debe confirmarse el pago");
      const sinVisita = db.vehiculos.filter((v) => v.clienteId === c.id && !db.visitas.some((x) => x.vehiculoId === v.id && x.tipo === "instalacion" && x.estado !== "cancelada"));
      if (sinVisita.length === 0) fail("Ya existe la orden de instalación");
      const o = db.ordenes.find((x) => x.clienteId === c.id && x.estado === "pagada");
      sinVisita.forEach((v, k) => {
        db.visitas.push({
          folio: cmd.folios[k] ?? fail("Faltan folios"),
          tipo: "instalacion",
          clienteId: c.id,
          vehiculoId: v.id,
          ordenFolio: o?.folio ?? null,
          ticketFolio: null,
          tecnicoId: null,
          comuna: c.comuna,
          fecha: null,
          bloque: null,
          estado: "por_agendar",
          causaFalla: null,
          reprogramaciones: 0,
          imei: null,
          checkInEn: null,
          checkOutEn: null,
          creadaEn: cmd.en,
          checklist: [],
          observaciones: null,
          fotos: 0,
        });
        ev(c.id, "visita", cmd.folios[k], "Orden de instalación creada", `${v.patente} · ${c.comuna}`);
      });
      return;
    }

    case "visita.reservar": {
      const v = visita(cmd.folio);
      const t = tecnico(cmd.tecnicoId);
      if (!["por_agendar", "lista_espera", "requiere_persona", "agendada", "confirmada", "tecnico_no_disponible", "no_show_cliente"].includes(v.estado)) {
        fail("Esta visita ya no se puede agendar");
      }
      const motivo = motivoNoDisponible(db, t, v.comuna, cmd.fecha, cmd.bloque, v.folio);
      if (motivo) fail(MOTIVO_NO_DISPONIBLE[motivo]);
      const reprograma = v.fecha !== null;
      if (reprograma) v.reprogramaciones++;
      v.tecnicoId = t.id;
      v.fecha = cmd.fecha;
      v.bloque = cmd.bloque;
      v.estado = "agendada";
      const c = cliente(v.clienteId);
      if (v.tipo === "instalacion" && c.estado === "PAGADO") {
        c.estado = "INSTALACIÓN AGENDADA";
        c.subestado = null;
      }
      ev(c.id, "visita", v.folio, reprograma ? "Reprogramada" : "INSTALACIÓN AGENDADA", `${cmd.fecha} · ${cmd.bloque} · ${t.nombre}`);
      return;
    }

    case "visita.avanzar": {
      const v = visita(cmd.folio);
      const desde: Record<typeof cmd.estado, Visita["estado"][]> = {
        confirmada: ["agendada"],
        en_camino: ["agendada", "confirmada"],
        en_instalacion: ["en_camino", "en_sitio"],
        en_pruebas: ["en_instalacion"],
      };
      if (!desde[cmd.estado].includes(v.estado)) fail("Ese paso no corresponde al estado actual de la visita");
      // En la demo se simula la ejecución sin esperar la fecha reservada.
      v.estado = cmd.estado;
      const c = cliente(v.clienteId);
      const tipo = { confirmada: "Asistencia confirmada", en_camino: "TÉCNICO EN CAMINO", en_instalacion: "EN INSTALACIÓN", en_pruebas: "En pruebas" }[cmd.estado];
      if (cmd.estado === "en_camino") c.subestado = "TÉCNICO EN CAMINO";
      if (cmd.estado === "en_instalacion") {
        v.checkInEn = cmd.en;
        c.subestado = "EN INSTALACIÓN";
      }
      ev(c.id, "visita", v.folio, tipo, null, "tecnico");
      return;
    }

    case "visita.checklist": {
      const v = visita(cmd.folio);
      if (!["en_instalacion", "en_pruebas", "en_sitio"].includes(v.estado)) fail("El checklist se completa durante la visita");
      v.checklist = cmd.hecho ? [...new Set([...v.checklist, cmd.item])] : v.checklist.filter((x) => x !== cmd.item);
      return;
    }

    case "visita.foto": {
      const v = visita(cmd.folio);
      if (!["en_instalacion", "en_pruebas", "en_sitio"].includes(v.estado)) fail("Las fotos se suben durante la visita");
      if (v.fotos >= 12) fail("Máximo 12 fotos por visita");
      v.fotos++;
      return;
    }

    case "visita.observaciones": {
      const v = visita(cmd.folio);
      v.observaciones = cmd.texto.trim() || null;
      return;
    }

    case "visita.cerrar": {
      const v = visita(cmd.folio);
      if (!["en_instalacion", "en_pruebas"].includes(v.estado)) fail("Solo se cierra una visita en curso");
      const plan = planDe(db, v.clienteId);
      const requeridos = CHECKLIST.filter((x) => x.id !== "rele" || plan !== "esencial").map((x) => x.id);
      const faltan = requeridos.filter((x) => !v.checklist.includes(x));
      if (faltan.length) fail(`Faltan ${faltan.length} ítems del checklist`);
      if (v.fotos < 3) fail("Sube al menos 3 fotos de evidencia");
      const gps = db.dispositivos.find((d) => d.imei === cmd.imeiGps);
      if (!gps || gps.tipo !== "gps" || !["en_stock", "asignado"].includes(gps.estado)) fail("El IMEI del GPS no está disponible en inventario");
      const necesitaTag = plan !== "esencial";
      const tag = cmd.imeiTag ? db.dispositivos.find((d) => d.imei === cmd.imeiTag) : null;
      if (necesitaTag && (!tag || tag.tipo !== "tag" || !["en_stock", "asignado"].includes(tag.estado))) fail("El plan requiere un TAG de respaldo disponible");
      const veh = db.vehiculos.find((x) => x.id === v.vehiculoId)!;
      for (const d of [gps, tag].filter(Boolean)) {
        d!.estado = "instalado";
        d!.vehiculoId = veh.id;
        d!.custodiaTecnicoId = null;
        d!.ultimoPulso = cmd.en;
      }
      veh.imeiGps = gps.imei;
      veh.imeiTag = tag?.imei ?? null;
      v.imei = gps.imei;
      v.estado = "cerrada_ok";
      v.checkOutEn = cmd.en;
      const c = cliente(v.clienteId);
      ev(c.id, "visita", v.folio, "INSTALADO", `Check-out con firma · IMEI ${gps.imei}`, "tecnico");
      const pendientes = db.visitas.filter((x) => x.clienteId === c.id && (x.tipo === "instalacion" || x.tipo === "segunda_visita") && !["cerrada_ok", "cancelada", "fallida"].includes(x.estado));
      if (pendientes.length === 0 && !c.instaladoEn) {
        c.instaladoEn = cmd.en;
        c.subestado = null;
        ev(c.id, "plataforma", c.id, "Activación pendiente", "Falta confirmar el pulso en GPSTracker (simulado)", "sistema");
      }
      return;
    }

    case "visita.fallar": {
      const v = visita(cmd.folio);
      if (!["en_camino", "en_instalacion", "en_pruebas", "en_sitio"].includes(v.estado)) fail("Solo una visita en curso puede fallar");
      v.estado = "fallida";
      v.causaFalla = cmd.causa;
      const c = cliente(v.clienteId);
      c.subestado = "INCIDENCIA INSTALACIÓN";
      db.tickets.push({
        folio: cmd.ticketFolio,
        clienteId: c.id,
        vehiculoId: v.vehiculoId,
        origen: "instalacion",
        nivel: "ATENCIÓN",
        estado: "ABIERTO",
        asunto: "Instalación fallida",
        detalle: `Causa informada por el técnico. ${v.observaciones ?? ""}`.trim(),
        visitaFolio: v.folio,
        responsableId: "usr-3",
        creadoEn: cmd.en,
        resueltoEn: null,
      });
      ev(c.id, "visita", v.folio, "INCIDENCIA INSTALACIÓN", `Causa: ${cmd.causa}`, "tecnico");
      ev(c.id, "ticket", cmd.ticketFolio, "Ticket automático", "Requiere revisión de Operaciones", "sistema");
      return;
    }

    case "visita.cancelar": {
      const v = visita(cmd.folio);
      if (["cerrada_ok", "cancelada"].includes(v.estado)) fail("La visita ya terminó");
      v.estado = "cancelada";
      const c = cliente(v.clienteId);
      if (v.tipo === "instalacion" && c.estado === "INSTALACIÓN AGENDADA") {
        c.estado = "PAGADO";
        c.subestado = null;
      }
      ev(c.id, "visita", v.folio, "Visita cancelada", cmd.motivo);
      return;
    }

    case "activacion.confirmar": {
      const c = cliente(cmd.clienteId);
      if (!c.instaladoEn) fail("Primero debe terminar la instalación física");
      if (c.activadoEn) fail("El servicio ya está activo");
      const vehs = db.vehiculos.filter((v) => v.clienteId === c.id && v.imeiGps);
      for (const veh of vehs) {
        veh.estado = "activo";
        db.dispositivos.filter((d) => d.vehiculoId === veh.id && d.estado === "instalado").forEach((d) => {
          d.estado = "activo";
          d.ultimoPulso = cmd.en;
        });
      }
      const inicio = cmd.en.slice(0, 10);
      db.suscripciones
        .filter((s) => s.clienteId === c.id && s.estado === "pendiente_instalacion")
        .forEach((s) => {
          s.estado = "activa";
          s.inicio = inicio;
          s.proximoCobro = addDays(inicio, s.periodicidad === "anual" ? 365 : 30);
        });
      c.activadoEn = cmd.en;
      c.estado = "ACTIVO";
      c.subestado = null;
      const cuenta = db.cuentas.find((x) => x.clienteId === c.id);
      if (cuenta) cuenta.estadoUsuario = "activo";
      ev(c.id, "plataforma", c.id, "VEHÍCULO ACTIVO", "Activación confirmada en modo demo · no se llamó a GPSTracker");
      ev(c.id, "cliente", c.id, "ACTIVO", null, "sistema");
      return;
    }

    case "tecnico.postular": {
      const d = cmd.datos;
      validarPersona(d.nombre, d.rut, d.email, d.telefono);
      if (db.tecnicos.some((t) => t.rut === d.rut)) fail("Ya existe un técnico con ese RUT");
      if (d.comunas.length === 0) fail("Elige al menos una comuna de cobertura");
      const t: Tecnico = {
        id: cmd.id,
        nombre: d.nombre.trim(),
        rut: d.rut,
        telefono: d.telefono.trim(),
        email: d.email.trim().toLowerCase(),
        comunas: d.comunas,
        estado: "postulante",
        cupoDiario: 2,
        validadoEn: null,
        postuladoEn: cmd.en.slice(0, 10),
        experienciaAnios: d.experienciaAnios,
        especialidades: d.especialidades,
        documentos: [
          { tipo: "cedula", estado: "pendiente" },
          { tipo: "antecedentes", estado: "pendiente" },
          { tipo: "licencia", estado: "pendiente" },
          { tipo: "certificacion", estado: "pendiente" },
        ],
        disponibilidad: d.disponibilidad,
      };
      db.tecnicos.push(t);
      ev(null, "tecnico", t.id, "Postulación recibida", t.nombre);
      return;
    }

    case "tecnico.estado": {
      const t = tecnico(cmd.tecnicoId);
      if (cmd.estado === "activo" && t.documentos.some((d) => d.estado !== "aprobado")) fail("Faltan documentos por aprobar");
      if (t.estado === cmd.estado) fail("El técnico ya está en ese estado");
      if (cmd.estado === "suspendido" || cmd.estado === "baja") {
        const futuras = db.visitas.filter((v) => v.tecnicoId === t.id && v.fecha && v.fecha >= db.hoy && ["agendada", "confirmada"].includes(v.estado));
        futuras.forEach((v) => {
          v.estado = "tecnico_no_disponible";
          ev(v.clienteId, "visita", v.folio, "Reasignar técnico", `${t.nombre} quedó ${cmd.estado === "baja" ? "de baja" : "suspendido"}`);
        });
      }
      t.estado = cmd.estado;
      if (cmd.estado === "activo") t.validadoEn = cmd.en.slice(0, 10);
      ev(null, "tecnico", t.id, `Técnico ${cmd.estado.replace("_", " ")}`, t.nombre);
      return;
    }

    case "tecnico.documento": {
      const t = tecnico(cmd.tecnicoId);
      const d = t.documentos.find((x) => x.tipo === cmd.documento) ?? fail("Documento no encontrado");
      d.estado = cmd.estado;
      if (t.estado === "postulante") t.estado = "en_validacion";
      return;
    }

    case "tecnico.editar": {
      const t = tecnico(cmd.tecnicoId);
      if (cmd.cupoDiario < 1 || cmd.cupoDiario > 4) fail("El cupo diario va de 1 a 4 visitas");
      if (cmd.comunas.length === 0) fail("Elige al menos una comuna");
      t.cupoDiario = cmd.cupoDiario;
      t.comunas = cmd.comunas;
      t.disponibilidad = cmd.disponibilidad;
      ev(null, "tecnico", t.id, "Ficha actualizada", "Cupo, cobertura y disponibilidad");
      return;
    }

    case "ticket.crear": {
      cliente(cmd.clienteId);
      if (cmd.asunto.trim().length < 4) fail("Escribe el asunto");
      db.tickets.push({
        folio: cmd.folio,
        clienteId: cmd.clienteId,
        vehiculoId: cmd.vehiculoId,
        origen: cmd.origen,
        nivel: cmd.nivel,
        estado: "ABIERTO",
        asunto: cmd.asunto.trim(),
        detalle: cmd.detalle.trim(),
        visitaFolio: null,
        responsableId: cmd.responsableId,
        creadoEn: cmd.en,
        resueltoEn: null,
      });
      const c = cliente(cmd.clienteId);
      if (c.estado === "ACTIVO" && !c.subestado) c.subestado = "SOPORTE ABIERTO";
      ev(c.id, "ticket", cmd.folio, "SOPORTE ABIERTO", cmd.asunto.trim());
      return;
    }

    case "ticket.estado": {
      const t = ticket(cmd.folio);
      if (t.estado === cmd.estado) fail("El ticket ya está en ese estado");
      t.estado = cmd.estado;
      t.resueltoEn = cmd.estado === "RESUELTO" ? cmd.en : null;
      const c = cliente(t.clienteId);
      const abiertos = db.tickets.some((x) => x.clienteId === c.id && x.estado !== "RESUELTO");
      if (!abiertos && c.subestado === "SOPORTE ABIERTO") c.subestado = null;
      ev(c.id, "ticket", t.folio, cmd.estado === "RESUELTO" ? "Ticket resuelto" : `Ticket ${cmd.estado.toLowerCase()}`, t.asunto);
      return;
    }

    case "ticket.asignar": {
      const t = ticket(cmd.folio);
      t.responsableId = cmd.responsableId;
      const quien = db.usuarios.find((u) => u.id === cmd.responsableId)?.nombre ?? "sin responsable";
      ev(t.clienteId, "ticket", t.folio, "Ticket asignado", quien);
      return;
    }

    case "suscripcion.cancelar": {
      const s = db.suscripciones.find((x) => x.id === cmd.id) ?? fail("Suscripción no encontrada");
      if (s.estado === "cancelada") fail("Ya está cancelada");
      s.estado = "cancelada";
      s.proximoCobro = null;
      const c = cliente(s.clienteId);
      const veh = db.vehiculos.find((v) => v.id === s.vehiculoId);
      if (veh) veh.estado = "baja";
      ev(c.id, "suscripcion", s.id, "Suscripción cancelada", cmd.motivo);
      if (db.suscripciones.filter((x) => x.clienteId === c.id).every((x) => x.estado === "cancelada")) {
        c.estado = "CANCELADO";
        c.subestado = null;
        c.motivoBaja = cmd.motivo;
        const cuenta = db.cuentas.find((x) => x.clienteId === c.id);
        if (cuenta) cuenta.estadoUsuario = "bloqueado";
        ev(c.id, "cliente", c.id, "CANCELADO", cmd.motivo);
      }
      return;
    }

    case "dispositivo.alta": {
      if (!/^\d{15}$/.test(cmd.imei)) fail("El IMEI debe tener 15 dígitos");
      if (db.dispositivos.some((d) => d.imei === cmd.imei)) return;
      db.dispositivos.push({
        imei: cmd.imei,
        modelo: cmd.dispositivo === "gps" ? "VL103M" : "PB705",
        tipo: cmd.dispositivo,
        simIccid: null,
        estado: cmd.custodiaTecnicoId ? "asignado" : "en_stock",
        custodiaTecnicoId: cmd.custodiaTecnicoId,
        vehiculoId: null,
        ultimoPulso: null,
        bateria: cmd.dispositivo === "tag" ? 100 : null,
      });
      ev(null, "dispositivo", cmd.imei, "Alta en inventario", cmd.origen);
      return;
    }

    case "visita.reservarExterna": {
      // La disponibilidad la decidió otro sistema (el portal del técnico): solo se
      // verifica que el bloque no choque con la agenda central del CRM.
      const v = visita(cmd.folio);
      const t = tecnico(cmd.tecnicoId);
      if (!["por_agendar", "lista_espera", "requiere_persona"].includes(v.estado)) fail("La visita ya tiene horario");
      const motivo = motivoNoDisponible(db, t, v.comuna, cmd.fecha, cmd.bloque, v.folio);
      if (motivo === "ocupado" || motivo === "cupo_lleno" || motivo === "inactivo") fail(`${MOTIVO_NO_DISPONIBLE[motivo]} en la agenda del CRM`);
      v.tecnicoId = t.id;
      v.fecha = cmd.fecha;
      v.bloque = cmd.bloque;
      v.estado = "agendada";
      const c = cliente(v.clienteId);
      if (v.tipo === "instalacion" && c.estado === "PAGADO") {
        c.estado = "INSTALACIÓN AGENDADA";
        c.subestado = null;
      }
      ev(c.id, "visita", v.folio, "INSTALACIÓN AGENDADA", `${cmd.fecha} · ${cmd.bloque} · ${t.nombre} · ${cmd.origen}`, "cliente");
      return;
    }

    case "integracion.registrar": {
      if (db.entradas.some((e) => e.id === cmd.eventoId)) fail("Este evento ya se aplicó");
      db.entradas.push({ id: cmd.eventoId, tipo: cmd.evento, origen: cmd.origen, recibidoEn: cmd.en, resumen: cmd.resumen, clienteId: cmd.clienteId });
      return;
    }

    case "cobro.reintentar": {
      const s = db.suscripciones.find((x) => x.id === cmd.suscripcionId) ?? fail("Suscripción no encontrada");
      if (s.estado !== "pago_pendiente" && s.estado !== "suspendida") fail("La suscripción no tiene cobros pendientes");
      const intentos = db.cobros.filter((x) => x.suscripcionId === s.id && x.fecha >= (s.morosoDesde ?? "")).length;
      const hoy = cmd.en.slice(0, 10);
      db.cobros.push({ id: `cob-${s.id}-d${intentos + 1}`, suscripcionId: s.id, clienteId: s.clienteId, fecha: hoy, monto: s.montoPeriodo, estado: cmd.aprobado ? "aprobado" : "rechazado", intento: intentos + 1 });
      const c = cliente(s.clienteId);
      if (!cmd.aprobado) {
        ev(c.id, "suscripcion", s.id, "Reintento rechazado", "Cobro simulado");
        return;
      }
      s.estado = "activa";
      s.morosoDesde = null;
      s.proximoCobro = addDays(hoy, s.periodicidad === "anual" ? 365 : 30);
      ev(c.id, "suscripcion", s.id, "Pago regularizado", "Cobro simulado aprobado · sin movimiento real", "sistema");
      if (db.suscripciones.filter((x) => x.clienteId === c.id).every((x) => x.estado === "activa" || x.estado === "cancelada")) {
        c.estado = "ACTIVO";
        c.subestado = null;
        const cuenta = db.cuentas.find((x) => x.clienteId === c.id);
        if (cuenta) cuenta.estadoUsuario = "activo";
      }
      return;
    }
  }
}

// ——— Validaciones compartidas ———

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^(\+?56)?9\d{8}$/;
const PATENTE = /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})$/;

const CAMPO: Record<keyof CambiosCliente, string> = {
  nombre: "nombre",
  email: "correo",
  telefono: "teléfono",
  direccion: "dirección",
  comuna: "comuna",
  responsableId: "responsable",
  consentimientoMarketing: "consentimiento",
};

function validarPersona(nombre: string, rut: string, email: string, telefono: string) {
  if (nombre.trim().split(/\s+/).length < 2) fail("Escribe nombre y apellido");
  if (!isValidRut(rut)) fail("RUT no válido");
  if (!EMAIL.test(email.trim())) fail("Correo no válido");
  if (!TELEFONO.test(telefono.replace(/\s/g, ""))) fail("Teléfono no válido: usa +56 9 XXXX XXXX");
}

function validarVehiculo(db: Db, v: DatosVehiculo) {
  const patente = v.patente.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PATENTE.test(patente)) fail("Patente no válida (ej. BKRT45)");
  if (db.vehiculos.some((x) => x.patente === patente && x.estado !== "baja")) fail("Esa patente ya está registrada");
  if (!v.marca.trim() || !v.modelo.trim()) fail("Completa marca y modelo");
  const year = new Date().getFullYear() + 1;
  if (!(v.anio >= 1990 && v.anio <= year)) fail("Año del vehículo no válido");
}

function nuevoVehiculo(id: string, clienteId: string, v: DatosVehiculo): Vehiculo {
  return {
    id,
    clienteId,
    patente: v.patente.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    marca: v.marca.trim(),
    modelo: v.modelo.trim(),
    anio: v.anio,
    color: v.color.trim() || "—",
    estado: "pendiente",
    imeiGps: null,
    imeiTag: null,
  };
}

function planDe(db: Db, clienteId: string): PlanId | null {
  return (
    db.suscripciones.find((s) => s.clienteId === clienteId)?.planId ??
    db.ordenes.find((o) => o.clienteId === clienteId && o.estado === "pagada")?.planId ??
    null
  );
}

// ——— Folios e identificadores para comandos nuevos ———

/** Siguiente folio correlativo: ORD-2026-051, VIS-2026-074, TK-2026-009. */
export function siguienteFolio(existentes: string[], prefijo: "ORD" | "VIS" | "TK", cuantos = 1): string[] {
  const year = new Date().getFullYear();
  const max = existentes.reduce((m, f) => {
    const n = Number(f.split("-").pop());
    return f.startsWith(`${prefijo}-`) && Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return Array.from({ length: cuantos }, (_, i) => `${prefijo}-${year}-${String(max + 1 + i).padStart(3, "0")}`);
}

/** Instante actual en hora de Santiago, con su desfase (ej. 2026-10-27T15:04:05-03:00). */
export function ahoraSantiago(date = new Date()): Iso {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const offset = (parts.timeZoneName as string).replace("GMT", "") || "+00:00";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}
