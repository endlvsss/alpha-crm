// Datos FICTICIOS para el mockup. Se generan de forma determinista a partir de
// la fecha de hoy (hora de Santiago), así que la agenda siempre se ve vigente y
// la misma fecha produce los mismos datos. Se reemplaza por la base de datos.

import { coverageTier } from "@/lib/comunas";
import type { IsoDate } from "@/lib/format";
import { computeDv, formatRut } from "@/lib/rut";
import { getPlan, quote, type Billing, type PlanId } from "@/lib/plans";
import type {
  AlertaPlataforma,
  CausaFalla,
  Cliente,
  Cobro,
  CuentaPlataforma,
  Dispositivo,
  EstadoCliente,
  Evento,
  Iso,
  Orden,
  Origen,
  SubestadoCliente,
  Suscripcion,
  Tecnico,
  Ticket,
  Vehiculo,
  Visita,
} from "@/lib/domain/types";

export interface Db {
  hoy: IsoDate;
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  ordenes: Orden[];
  suscripciones: Suscripcion[];
  cobros: Cobro[];
  tecnicos: Tecnico[];
  visitas: Visita[];
  dispositivos: Dispositivo[];
  tickets: Ticket[];
  cuentas: CuentaPlataforma[];
  alertas: AlertaPlataforma[];
  eventos: Evento[];
}

// ——— Utilidades ———

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function santiagoToday(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekday(iso: IsoDate): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** Lleva una fecha al siguiente día hábil (lunes a sábado). */
function workday(iso: IsoDate): IsoDate {
  return weekday(iso) === 0 ? addDays(iso, 1) : iso;
}

/** Instante en hora de Chile (verano, UTC−3). */
function at(date: IsoDate, time: string): Iso {
  return `${date}T${time}:00-03:00`;
}

const pad = (n: number, size = 3) => String(n).padStart(size, "0");

// ——— Catálogos ———

const NOMBRES = [
  "Juan", "Camila", "Felipe", "Javiera", "Matías", "Constanza", "Sebastián", "Valentina",
  "Cristóbal", "Francisca", "Tomás", "Catalina", "Ignacio", "Daniela", "Rodrigo", "Fernanda",
  "Andrés", "Paula", "Nicolás", "Carolina", "Diego", "Antonia", "Gonzalo", "Macarena",
  "Pablo", "Josefa", "Álvaro", "Isidora", "Héctor", "Bárbara",
];
const APELLIDOS = [
  "González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez",
  "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya",
  "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro",
  "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández",
];
const AUTOS: [string, string][] = [
  ["Toyota", "Yaris"], ["Chevrolet", "Sail"], ["Suzuki", "Swift"], ["Kia", "Rio"],
  ["Hyundai", "Accent"], ["Nissan", "Versa"], ["Mazda", "CX-5"], ["Toyota", "RAV4"],
  ["Mitsubishi", "L200"], ["Chevrolet", "Tracker"], ["Peugeot", "208"], ["Hyundai", "Tucson"],
  ["Kia", "Sportage"], ["Toyota", "Hilux"], ["Nissan", "Navara"], ["MG", "ZS"],
];
const COLORES = ["Blanco", "Gris plata", "Negro", "Rojo", "Azul", "Gris oscuro"];
const CALLES = [
  "Av. Irarrázaval", "Av. Grecia", "Av. Vicuña Mackenna", "Av. Pajaritos", "Los Leones",
  "Av. Tobalaba", "Gran Avenida", "Av. Macul", "Av. Las Condes", "Av. La Florida",
  "Av. Independencia", "Av. Recoleta", "San Pablo", "Av. Matta", "Av. Ossa",
];
const COMUNAS_DEMANDA = [
  "Ñuñoa", "Providencia", "Las Condes", "Maipú", "La Florida", "Puente Alto", "Santiago",
  "Peñalolén", "Macul", "La Reina", "San Miguel", "Estación Central", "Vitacura",
  "Huechuraba", "Pudahuel", "Quilicura", "Lo Barnechea", "La Cisterna", "Independencia",
];
const COMUNAS_SIN_TECNICO = ["Colina", "Lampa", "Talagante", "Buin", "Paine", "Curacaví"];
const CAMPANAS: Record<Origen, string | null> = {
  meta: "robo-nocturno-oct",
  google: "rastreo-gps-santiago",
  tiktok: "3-12am-reel",
  organico: null,
  referido: null,
  whatsapp: null,
};
const PATENTE_LETRAS = "BCDFGHJKLPRSTVWXYZ";

export const BLOQUES = ["09:00", "11:00", "14:00", "16:00"] as const;

export const BLOQUE_FIN: Record<string, string> = {
  "09:00": "11:00",
  "11:00": "13:00",
  "14:00": "16:00",
  "16:00": "18:00",
};

// ——— Técnicos ———

const TECNICOS: Tecnico[] = [
  {
    id: "tec-1",
    nombre: "Diego Fuentes",
    rut: "15.932.118-5",
    telefono: "+56 9 6123 4401",
    email: "diego.fuentes@correo.cl",
    comunas: ["Ñuñoa", "Providencia", "Santiago", "La Reina", "Macul", "Peñalolén", "Las Condes", "Vitacura"],
    estado: "activo",
    cupoDiario: 3,
    validadoEn: "2026-09-02",
  },
  {
    id: "tec-2",
    nombre: "Valentina Rojas",
    rut: "17.204.556-3",
    telefono: "+56 9 7745 1180",
    email: "vale.rojas@correo.cl",
    comunas: ["La Florida", "Puente Alto", "San Miguel", "La Cisterna", "Macul", "San Joaquín", "La Granja"],
    estado: "activo",
    cupoDiario: 3,
    validadoEn: "2026-09-09",
  },
  {
    id: "tec-3",
    nombre: "Matías Herrera",
    rut: "16.488.031-K",
    telefono: "+56 9 5310 9922",
    email: "m.herrera.inst@correo.cl",
    comunas: ["Maipú", "Estación Central", "Pudahuel", "Cerrillos", "Quinta Normal", "Lo Prado", "Santiago"],
    estado: "activo",
    cupoDiario: 2,
    validadoEn: "2026-09-16",
  },
  {
    id: "tec-4",
    nombre: "Camila Soto",
    rut: "18.110.947-2",
    telefono: "+56 9 8802 3374",
    email: "camila.soto.gps@correo.cl",
    comunas: ["Huechuraba", "Quilicura", "Independencia", "Recoleta", "Conchalí", "Lo Barnechea", "Vitacura", "Las Condes"],
    estado: "activo",
    cupoDiario: 3,
    validadoEn: "2026-09-23",
  },
  {
    id: "tec-5",
    nombre: "Joaquín Muñoz",
    rut: "19.336.702-8",
    telefono: "+56 9 4471 2093",
    email: "joaquin.munoz@correo.cl",
    comunas: ["Colina", "Lampa", "Quilicura"],
    estado: "en_validacion",
    cupoDiario: 2,
    validadoEn: null,
  },
  {
    id: "tec-6",
    nombre: "Fernanda Díaz",
    rut: "20.118.453-1",
    telefono: "+56 9 9014 6620",
    email: "fer.diaz.tec@correo.cl",
    comunas: ["Talagante", "Peñaflor", "Padre Hurtado"],
    estado: "postulante",
    cupoDiario: 2,
    validadoEn: null,
  },
];

// ——— Escenarios: un cliente por entrada, repartidos por el blueprint ———

type Escenario =
  | "interesado"
  | "checkout"
  | "abandonado"
  | "por_agendar"
  | "lista_espera"
  | "requiere_persona"
  | "agendada"
  | "en_camino"
  | "en_instalacion"
  | "incidencia"
  | "activo"
  | "activo_flota"
  | "activo_soporte"
  | "activo_desacople"
  | "pago_pendiente"
  | "suspendido"
  | "cancelado"
  | "cancelado_previo";

const ESCENARIOS: Escenario[] = [
  ...Array<Escenario>(4).fill("interesado"),
  ...Array<Escenario>(3).fill("checkout"),
  ...Array<Escenario>(5).fill("abandonado"),
  ...Array<Escenario>(3).fill("por_agendar"),
  ...Array<Escenario>(2).fill("lista_espera"),
  "requiere_persona",
  ...Array<Escenario>(6).fill("agendada"),
  "en_camino",
  "en_instalacion",
  ...Array<Escenario>(2).fill("incidencia"),
  ...Array<Escenario>(12).fill("activo"),
  ...Array<Escenario>(2).fill("activo_flota"),
  "activo_soporte",
  "activo_desacople",
  ...Array<Escenario>(2).fill("pago_pendiente"),
  ...Array<Escenario>(2).fill("suspendido"),
  ...Array<Escenario>(2).fill("cancelado"),
  "cancelado_previo",
];

const ESTADO_DE: Record<Escenario, [EstadoCliente, SubestadoCliente | null]> = {
  interesado: ["LEAD", "INTERESADO"],
  checkout: ["LEAD", "CHECKOUT INICIADO"],
  abandonado: ["LEAD", "CHECKOUT ABANDONADO"],
  por_agendar: ["PAGADO", null],
  lista_espera: ["PAGADO", null],
  requiere_persona: ["PAGADO", null],
  agendada: ["INSTALACIÓN AGENDADA", null],
  en_camino: ["INSTALACIÓN AGENDADA", "TÉCNICO EN CAMINO"],
  en_instalacion: ["INSTALACIÓN AGENDADA", "EN INSTALACIÓN"],
  incidencia: ["INSTALACIÓN AGENDADA", "INCIDENCIA INSTALACIÓN"],
  activo: ["ACTIVO", null],
  activo_flota: ["ACTIVO", null],
  activo_soporte: ["ACTIVO", "SOPORTE ABIERTO"],
  activo_desacople: ["ACTIVO", "SOPORTE ABIERTO"],
  pago_pendiente: ["ACTIVO", "PAGO PENDIENTE"],
  suspendido: ["SUSPENDIDO", null],
  cancelado: ["CANCELADO", null],
  cancelado_previo: ["CANCELADO", null],
};

// ——— Generador ———

export function buildDb(hoy: IsoDate = santiagoToday()): Db {
  const rnd = mulberry32(20261015);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  const time = () => `${pad(int(8, 21), 2)}:${pad(int(0, 59), 2)}`;
  /** Una hora después de otra el mismo día (máximo 23:59), para que la bitácora quede en orden. */
  const after = (hhmm: string, min: number) => {
    const t = Math.min(23 * 60 + 59, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + min);
    return `${pad(Math.floor(t / 60), 2)}:${pad(t % 60, 2)}`;
  };

  const db: Db = {
    hoy,
    clientes: [],
    vehiculos: [],
    ordenes: [],
    suscripciones: [],
    cobros: [],
    tecnicos: TECNICOS,
    visitas: [],
    dispositivos: [],
    tickets: [],
    cuentas: [],
    alertas: [],
    eventos: [],
  };

  let nOrden = 0;
  let nVisita = 0;
  let nTicket = 0;
  let nEvento = 0;
  let nImei = 0;
  const ocupados = new Set<string>();

  const imei = (tipo: "gps" | "tag") => {
    nImei++;
    return tipo === "gps" ? `8690660656${pad(nImei, 5)}` : `7809018077${pad(nImei, 5)}`;
  };

  const patente = () =>
    Array.from({ length: 4 }, () => pick(PATENTE_LETRAS.split(""))).join("") + pad(int(10, 99), 2);

  const evento = (
    c: Cliente,
    entidad: Evento["entidad"],
    entidadRef: string,
    tipo: string,
    en: Iso,
    actor: Evento["actor"] = "sistema",
    detalle: string | null = null,
  ) => {
    db.eventos.push({ id: `ev-${pad(++nEvento, 4)}`, clienteId: c.id, entidad, entidadRef, tipo, detalle, actor, en });
  };

  const tecnicoPara = (comuna: string): Tecnico | undefined =>
    TECNICOS.find((t) => t.estado === "activo" && t.comunas.includes(comuna)) ??
    (coverageTier(comuna) === "alta" || coverageTier(comuna) === "media"
      ? TECNICOS.find((t) => t.estado === "activo")
      : undefined);

  /** Primer bloque libre del técnico desde una fecha (cupo y doble reserva). */
  const reservar = (tecnico: Tecnico, desde: IsoDate, preferido?: string): [IsoDate, string] => {
    let fecha = workday(desde);
    for (let i = 0; i < 30; i++) {
      const usados = BLOQUES.filter((b) => ocupados.has(`${tecnico.id}|${fecha}|${b}`)).length;
      if (usados < tecnico.cupoDiario) {
        const orden = preferido ? [preferido, ...BLOQUES.filter((b) => b !== preferido)] : [...BLOQUES].sort(() => rnd() - 0.5);
        const libre = orden.find((b) => !ocupados.has(`${tecnico.id}|${fecha}|${b}`));
        if (libre) {
          ocupados.add(`${tecnico.id}|${fecha}|${libre}`);
          return [fecha, libre];
        }
      }
      fecha = workday(addDays(fecha, 1));
    }
    return [fecha, BLOQUES[0]];
  };

  ESCENARIOS.forEach((esc, i) => {
    const [estado, subestado] = ESTADO_DE[esc];
    const nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
    const body = String(int(9_000_000, 21_999_999));
    const comuna =
      esc === "lista_espera" || esc === "requiere_persona" ? pick(COMUNAS_SIN_TECNICO) : pick(COMUNAS_DEMANDA);
    const origen = pick<Origen>(["meta", "meta", "meta", "google", "google", "tiktok", "organico", "referido", "whatsapp"]);
    const planId: PlanId =
      esc === "activo_flota" ? "flota" : rnd() < 0.68 ? "seguridad" : "esencial";
    const periodicidad: Billing = rnd() < 0.55 ? "anual" : "mensual";
    const nVeh = planId === "flota" ? 3 : 1;

    // Antigüedad según la etapa: los activos llevan más tiempo.
    const antiguedad: Record<Escenario, [number, number]> = {
      interesado: [0, 6], checkout: [0, 3], abandonado: [2, 14],
      por_agendar: [1, 3], lista_espera: [4, 9], requiere_persona: [12, 16],
      agendada: [1, 5], en_camino: [3, 6], en_instalacion: [3, 6], incidencia: [5, 9],
      activo: [12, 95], activo_flota: [30, 70], activo_soporte: [25, 60], activo_desacople: [20, 50],
      pago_pendiente: [35, 70], suspendido: [55, 90], cancelado: [60, 110], cancelado_previo: [8, 15],
    };
    const [minA, maxA] = antiguedad[esc];
    const diaAlta = addDays(hoy, -int(minA, maxA));
    const horaAlta = `${pad(int(8, 20), 2)}:${pad(int(0, 59), 2)}`;

    const cliente: Cliente = {
      id: `cli-${pad(i + 1)}`,
      nombre,
      rut: formatRut(body + computeDv(body)),
      email: `${nombre.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${nombre
        .split(" ")[1]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")}${int(1, 99)}@correo.cl`,
      telefono: `+56 9 ${int(4000, 9999)} ${int(1000, 9999)}`,
      comuna,
      direccion: `${pick(CALLES)} ${int(100, 4999)}${rnd() < 0.4 ? `, depto. ${int(101, 1802)}` : ""}`,
      estado,
      subestado,
      origen,
      campana: CAMPANAS[origen],
      consentimientoMarketing: rnd() < 0.62,
      creadoEn: at(diaAlta, horaAlta),
      cuentaCreadaEn: null,
      instaladoEn: null,
      motivoBaja: null,
    };
    db.clientes.push(cliente);
    evento(cliente, "cliente", cliente.id, "LEAD", cliente.creadoEn, "sistema", `${origen}${cliente.campana ? ` · ${cliente.campana}` : ""}`);
    evento(cliente, "cliente", cliente.id, "INTERESADO", at(diaAlta, after(horaAlta, 4)), "cliente", "Vio planes en la landing");

    // Vehículos
    const vehiculos: Vehiculo[] = Array.from({ length: nVeh }, (_, k) => {
      const [marca, modelo] = pick(AUTOS);
      return {
        id: `veh-${pad(i + 1)}-${k + 1}`,
        clienteId: cliente.id,
        patente: patente(),
        marca,
        modelo,
        anio: int(2014, 2025),
        color: pick(COLORES),
        estado: "pendiente",
        imeiGps: null,
        imeiTag: null,
      };
    });
    if (esc !== "interesado") db.vehiculos.push(...vehiculos);
    if (esc === "interesado") return;

    // Orden
    const q = quote(getPlan(planId), periodicidad, nVeh);
    const orden: Orden = {
      folio: "",
      clienteId: cliente.id,
      planId,
      periodicidad,
      vehiculos: nVeh,
      estado: "checkout_iniciado",
      montoTotal: q.dueToday,
      pasarela: "webpay",
      pagoRef: null,
      creadaEn: minA > 1 && rnd() < 0.5 ? at(addDays(diaAlta, 1), time()) : at(diaAlta, after(horaAlta, int(10, 50))),
      pagadaEn: null,
    };
    db.ordenes.push(orden);
    evento(cliente, "orden", "", "CHECKOUT INICIADO", orden.creadaEn, "cliente", `${getPlan(planId).name} · ${periodicidad}`);

    if (esc === "checkout") return;
    if (esc === "abandonado") {
      orden.estado = "abandonada";
      evento(cliente, "orden", "", "CHECKOUT ABANDONADO", at(addDays(orden.creadaEn.slice(0, 10), 1), "00:30"), "sistema",
        cliente.consentimientoMarketing ? "En recuperación por correo y anuncios" : "Sin consentimiento: no se contacta");
      return;
    }

    // Pago aprobado (a veces tras un rechazo)
    const diaPago = orden.creadaEn.slice(0, 10);
    const horaCheckout = orden.creadaEn.slice(11, 16);
    if (rnd() < 0.18) {
      evento(cliente, "orden", "", "Pago rechazado", at(diaPago, after(horaCheckout, 5)), "sistema", "Webpay · fondos insuficientes · se invita a reintentar");
    }
    orden.estado = "pagada";
    orden.pagadaEn = at(diaPago, after(horaCheckout, 9));
    orden.pagoRef = `WP-${int(10_000_000, 99_999_999)}`;
    cliente.cuentaCreadaEn = orden.pagadaEn;
    evento(cliente, "orden", "", "PAGADO", orden.pagadaEn, "sistema", `Webpay ${orden.pagoRef}`);
    evento(cliente, "plataforma", cliente.id, "CUENTA CREADA", orden.pagadaEn, "sistema", "Usuario «Cliente» invitado en GPSTracker (sin GPS aún)");

    const cuenta: CuentaPlataforma = {
      clienteId: cliente.id,
      estadoUsuario: rnd() < 0.8 ? "activo" : "pendiente",
      invitadoEn: orden.pagadaEn,
      ultimoIngreso: null,
    };
    db.cuentas.push(cuenta);

    // Suscripción por vehículo
    const subs: Suscripcion[] = vehiculos.map((v, k) => ({
      id: `sus-${pad(i + 1)}-${k + 1}`,
      clienteId: cliente.id,
      vehiculoId: v.id,
      planId,
      periodicidad,
      estado: "pendiente_instalacion",
      montoPeriodo: periodicidad === "anual" ? getPlan(planId).monthly * 10 : getPlan(planId).monthly,
      inicio: null,
      proximoCobro: null,
      morosoDesde: null,
    }));
    db.suscripciones.push(...subs);

    if (esc === "cancelado_previo") {
      orden.estado = "reembolsada";
      cliente.motivoBaja = "Cambió de opinión antes de la instalación";
      subs.forEach((s) => (s.estado = "cancelada"));
      cuenta.estadoUsuario = "bloqueado";
      evento(cliente, "cliente", cliente.id, "CANCELACIÓN SOLICITADA", at(addDays(diaPago, 2), "11:20"), "cliente", cliente.motivoBaja);
      evento(cliente, "cliente", cliente.id, "CANCELADO", at(addDays(diaPago, 3), "10:00"), "operaciones", "Devolución total (política POR DEFINIR)");
      return;
    }

    // Visita de instalación (una por vehículo)
    const tecnico = tecnicoPara(comuna);
    const visitas: Visita[] = vehiculos.map((v) => ({
      folio: "",
      tipo: "instalacion",
      clienteId: cliente.id,
      vehiculoId: v.id,
      ordenFolio: null,
      ticketFolio: null,
      tecnicoId: null,
      comuna,
      fecha: null,
      bloque: null,
      estado: "por_agendar",
      causaFalla: null,
      reprogramaciones: 0,
      imei: null,
      checkInEn: null,
      checkOutEn: null,
      creadaEn: orden.pagadaEn!,
    }));
    db.visitas.push(...visitas);

    if (esc === "por_agendar") return;
    if (esc === "lista_espera" || esc === "requiere_persona") {
      visitas[0].estado = esc;
      evento(cliente, "visita", "", "Sin cupo compatible", at(addDays(diaPago, 1), "09:12"), "cliente", `${comuna}: se mostraron otras fechas y un rango mayor`);
      evento(cliente, "visita", "", "Lista de espera", at(addDays(diaPago, 1), "09:15"), "cliente", "«Avísame cuando haya disponibilidad»");
      if (esc === "requiere_persona") {
        evento(cliente, "visita", "", "Requiere persona", at(addDays(diaPago, 10), "09:00"), "sistema", "10 días en lista de espera sin cupo · bandeja de Operaciones");
      }
      return;
    }

    const asignar = (v: Visita, fecha: IsoDate, bloque: string, t: Tecnico) => {
      v.tecnicoId = t.id;
      v.fecha = fecha;
      v.bloque = bloque;
      v.estado = "agendada";
      ocupados.add(`${t.id}|${fecha}|${bloque}`);
    };

    const tec = tecnico ?? TECNICOS[0];
    const instaladas = ["activo", "activo_flota", "activo_soporte", "activo_desacople", "pago_pendiente", "suspendido", "cancelado", "incidencia"];

    if (esc === "en_camino" || esc === "en_instalacion") {
      const bloque = esc === "en_camino" ? "11:00" : "09:00";
      asignar(visitas[0], workday(hoy), bloque, tec);
      visitas[0].estado = esc === "en_camino" ? "en_camino" : "en_instalacion";
      evento(cliente, "visita", "", "INSTALACIÓN AGENDADA", at(addDays(diaPago, 1), "10:02"), "cliente", `${workday(hoy)} · ${bloque}`);
      evento(cliente, "visita", "", "Asistencia confirmada", at(addDays(hoy, -1), "09:00"), "tecnico");
      evento(cliente, "visita", "", "TÉCNICO EN CAMINO", at(hoy, esc === "en_camino" ? "10:31" : "08:24"), "tecnico");
      if (esc === "en_instalacion") {
        visitas[0].checkInEn = at(hoy, "09:06");
        evento(cliente, "visita", "", "EN INSTALACIÓN", visitas[0].checkInEn, "tecnico", "Check-in: patente verificada · 5 fotos");
      }
      return;
    }

    if (esc === "agendada") {
      const [fecha, bloque] = reservar(tec, addDays(hoy, int(0, 9)));
      visitas[0].tecnicoId = tec.id;
      visitas[0].fecha = fecha;
      visitas[0].bloque = bloque;
      visitas[0].estado = fecha <= addDays(hoy, 1) ? "confirmada" : "agendada";
      evento(cliente, "visita", "", "INSTALACIÓN AGENDADA", at(addDays(diaPago, 1), "10:02"), "cliente", `${fecha} · ${bloque}`);
      if (visitas[0].estado === "confirmada") evento(cliente, "visita", "", "Asistencia confirmada", at(addDays(fecha, -1), "09:00"), "tecnico");
      return;
    }

    if (!instaladas.includes(esc)) return;

    // Instalación ya hecha (o fallida)
    const diaInst = workday(addDays(diaPago, int(2, 5)));
    visitas.forEach((v, k) => {
      const [fecha, bloque] = reservar(tec, diaInst, BLOQUES[k % BLOQUES.length]);
      asignar(v, fecha, bloque, tec);
      v.checkInEn = at(fecha, bloque.replace(/:00$/, ":12"));
    });
    evento(cliente, "visita", "", "INSTALACIÓN AGENDADA", at(addDays(diaPago, 1), "10:02"), "cliente", `${diaInst} · ${visitas[0].bloque}`);
    evento(cliente, "visita", "", "TÉCNICO EN CAMINO", at(diaInst, "08:20"), "tecnico");
    evento(cliente, "visita", "", "EN INSTALACIÓN", visitas[0].checkInEn!, "tecnico", "Check-in: patente verificada · 5 fotos");

    if (esc === "incidencia") {
      const causa = pick<CausaFalla>(["electrico", "senal", "falla_gps", "incompatibilidad"]);
      visitas[0].estado = "fallida";
      visitas[0].causaFalla = causa;
      const folioTk = `TK-2026-${pad(++nTicket)}`;
      db.tickets.push({
        folio: folioTk,
        clienteId: cliente.id,
        vehiculoId: vehiculos[0].id,
        origen: "instalacion",
        nivel: "ATENCIÓN",
        estado: "EN REVISIÓN",
        asunto: "Instalación fallida",
        detalle: `Causa: ${causa}. El técnico subió fotos y evidencia. Se coordina segunda visita.`,
        visitaFolio: null,
        creadoEn: at(visitas[0].fecha!, "12:40"),
        resueltoEn: null,
      });
      evento(cliente, "visita", "", "INCIDENCIA INSTALACIÓN", at(visitas[0].fecha!, "12:38"), "tecnico", `Causa: ${causa}`);
      evento(cliente, "ticket", folioTk, "Ticket automático", at(visitas[0].fecha!, "12:40"), "sistema", "Soporte + cliente avisados: qué pasó y qué sigue");
      if (causa === "falla_gps") {
        db.dispositivos.push({ imei: imei("gps"), modelo: "VL103M", tipo: "gps", simIccid: `8956${int(1e9, 9e9)}`, estado: "falla", custodiaTecnicoId: tec.id, vehiculoId: null, ultimoPulso: null, bateria: null });
      }
      // Segunda visita
      const [f2, b2] = reservar(tec, addDays(hoy, int(1, 6)));
      db.visitas.push({
        ...visitas[0],
        folio: "",
        tipo: "segunda_visita",
        ticketFolio: folioTk,
        fecha: f2,
        bloque: b2,
        estado: "agendada",
        causaFalla: null,
        checkInEn: null,
        creadaEn: at(addDays(visitas[0].fecha!, 1), "10:00"),
      });
      evento(cliente, "visita", "", "Segunda visita agendada", at(addDays(visitas[0].fecha!, 1), "10:00"), "operaciones", `${f2} · ${b2}`);
      return;
    }

    // Instalación OK → INSTALADO → ACTIVO
    const relay = planId !== "esencial";
    visitas.forEach((v, k) => {
      const veh = vehiculos[k];
      const gps = imei("gps");
      const tag = relay ? imei("tag") : null;
      v.estado = "cerrada_ok";
      v.imei = gps;
      v.checkOutEn = at(v.fecha!, v.bloque!.replace(/:00$/, ":58"));
      veh.estado = "activo";
      veh.imeiGps = gps;
      veh.imeiTag = tag;
      const pulso = esc === "suspendido" || esc === "cancelado" ? null : at(hoy, `${pad(int(6, 9), 2)}:${pad(int(0, 59), 2)}`);
      db.dispositivos.push({ imei: gps, modelo: "VL103M", tipo: "gps", simIccid: `8956${int(1e9, 9e9)}`, estado: esc === "cancelado" ? "retirado" : "activo", custodiaTecnicoId: null, vehiculoId: veh.id, ultimoPulso: pulso, bateria: null });
      if (tag) db.dispositivos.push({ imei: tag, modelo: "PB705", tipo: "tag", simIccid: null, estado: esc === "cancelado" ? "retirado" : "activo", custodiaTecnicoId: null, vehiculoId: veh.id, ultimoPulso: pulso, bateria: int(54, 100) });
    });
    const fin = visitas[visitas.length - 1].checkOutEn!;
    cliente.instaladoEn = fin;
    cuenta.estadoUsuario = "activo";
    cuenta.ultimoIngreso = at(addDays(hoy, -int(0, 6)), time());
    evento(cliente, "visita", "", "INSTALADO", fin, "tecnico", `Check-out con firma · IMEI ${visitas[0].imei}`);
    evento(cliente, "plataforma", cliente.id, "VEHÍCULO ACTIVO", fin, "sistema", `IMEI vinculado en GPSTracker${nVeh > 1 ? ` (${nVeh} vehículos)` : ""}`);

    // Cobros mensuales desde la instalación
    const inicio = fin.slice(0, 10);
    subs.forEach((s) => {
      s.estado = "activa";
      s.inicio = inicio;
      const meses = periodicidad === "anual" ? 12 : 1;
      let prox = inicio;
      let n = 0;
      while (prox <= hoy) {
        prox = addDays(prox, meses === 12 ? 365 : 30);
        n++;
        if (prox <= hoy) {
          db.cobros.push({ id: `cob-${s.id}-${n}`, suscripcionId: s.id, clienteId: cliente.id, fecha: prox, monto: s.montoPeriodo, estado: "aprobado", intento: 1 });
        }
      }
      s.proximoCobro = prox;
    });

    if (esc === "activo_soporte" || esc === "activo_desacople") {
      const desacople = esc === "activo_desacople";
      const folioTk = `TK-2026-${pad(++nTicket)}`;
      const creado = at(addDays(hoy, -int(1, 3)), time());
      const visitaTec = !desacople;
      db.tickets.push({
        folio: folioTk,
        clienteId: cliente.id,
        vehiculoId: vehiculos[0].id,
        origen: desacople ? "desacople" : "gps_offline",
        nivel: desacople ? "URGENTE" : "ATENCIÓN",
        estado: visitaTec ? "VISITA TÉCNICA" : "EN REVISIÓN",
        asunto: desacople ? "Señal principal y de respaldo separadas" : "GPS sin reportar (persistente)",
        detalle: desacople
          ? "La señal de respaldo dejó de estar junto a la principal. Soporte contacta al cliente."
          : "El equipo no reporta hace más de 24 h. El diagnóstico remoto no lo resolvió: se agenda visita técnica.",
        visitaFolio: null,
        creadoEn: creado,
        resueltoEn: null,
      });
      db.alertas.push({ id: `al-${folioTk}`, clienteId: cliente.id, vehiculoId: vehiculos[0].id, tipo: desacople ? "Desacople GPS–TAG" : "GPS sin reportar", severidad: desacople ? "critica" : "alta", en: creado, resuelta: false });
      evento(cliente, "ticket", folioTk, "SOPORTE ABIERTO", creado, "sistema", desacople ? "Alerta crítica de desacople · Telegram URGENTE" : "GPS offline persistente");
      if (visitaTec) {
        const [f, b] = reservar(tec, addDays(hoy, 1));
        db.visitas.push({
          ...visitas[0], folio: "", tipo: "visita_tecnica", ticketFolio: folioTk, fecha: f, bloque: b, estado: "agendada",
          imei: visitas[0].imei, checkInEn: null, checkOutEn: null, creadaEn: creado,
        });
        evento(cliente, "visita", "", "Visita técnica agendada", creado, "operaciones", `${f} · ${b}`);
        const d = db.dispositivos.find((x) => x.imei === vehiculos[0].imeiGps);
        if (d) d.ultimoPulso = at(addDays(hoy, -2), "17:40");
      }
    }

    if (esc === "pago_pendiente" || esc === "suspendido") {
      const diasMora = esc === "pago_pendiente" ? int(3, 11) : int(19, 28);
      const desde = addDays(hoy, -diasMora);
      subs.forEach((s) => {
        s.estado = esc === "pago_pendiente" ? "pago_pendiente" : "suspendida";
        s.morosoDesde = desde;
        s.proximoCobro = desde;
        db.cobros.push({ id: `cob-${s.id}-r1`, suscripcionId: s.id, clienteId: cliente.id, fecha: desde, monto: s.montoPeriodo, estado: "rechazado", intento: 1 });
        db.cobros.push({ id: `cob-${s.id}-r2`, suscripcionId: s.id, clienteId: cliente.id, fecha: addDays(desde, 3), monto: s.montoPeriodo, estado: "rechazado", intento: 2 });
      });
      evento(cliente, "suscripcion", subs[0].id, "PAGO PENDIENTE", at(desde, "06:00"), "sistema", "Primer aviso + enlace de pago");
      evento(cliente, "suscripcion", subs[0].id, "Segundo intento rechazado", at(addDays(desde, 3), "06:00"), "sistema");
      if (esc === "suspendido") {
        cuenta.estadoUsuario = "bloqueado";
        evento(cliente, "suscripcion", subs[0].id, "SUSPENDIDO", at(addDays(desde, 15), "06:00"), "sistema", "Fin del período de gracia (~15 días, referencial)");
      }
    }

    if (esc === "cancelado") {
      const dia = addDays(hoy, -int(4, 20));
      cliente.motivoBaja = pick(["Vendió el vehículo", "Precio", "Poco uso"]);
      subs.forEach((s) => {
        s.estado = "cancelada";
        s.proximoCobro = null;
      });
      vehiculos.forEach((v) => (v.estado = "baja"));
      cuenta.estadoUsuario = "bloqueado";
      evento(cliente, "cliente", cliente.id, "Pide cancelar", at(dia, "15:22"), "cliente", `Motivo: ${cliente.motivoBaja}`);
      evento(cliente, "cliente", cliente.id, "Alternativa ofrecida", at(dia, "15:23"), "sistema",
        cliente.motivoBaja === "Vendió el vehículo" ? "Traslado al vehículo nuevo" : cliente.motivoBaja === "Precio" ? "Plan inferior" : "Ayuda para usar alertas y geocercas");
      evento(cliente, "cliente", cliente.id, "CANCELADO", at(addDays(dia, 1), "09:00"), "cliente", "Insistió en cancelar");
    }

    // Alertas de la plataforma para los activos
    if (["activo", "activo_flota", "activo_soporte", "pago_pendiente"].includes(esc) && relay) {
      const n = int(0, 3);
      for (let k = 0; k < n; k++) {
        db.alertas.push({
          id: `al-${cliente.id}-${k}`,
          clienteId: cliente.id,
          vehiculoId: vehiculos[0].id,
          tipo: pick(["Encendido sin autorización", "Exceso de velocidad", "Salida de geocerca", "Entrada a geocerca"]),
          severidad: pick(["critica", "alta", "media", "baja"]),
          en: at(addDays(hoy, -int(0, 20)), time()),
          resuelta: rnd() < 0.8,
        });
      }
    }
  });

  // Inventario en stock y en custodia de los técnicos
  for (let k = 0; k < 14; k++) {
    const tipo = k % 2 === 0 ? "gps" : "tag";
    const custodia = k < 8 ? TECNICOS[k % 4].id : null;
    db.dispositivos.push({
      imei: imei(tipo),
      modelo: tipo === "gps" ? "VL103M" : "PB705",
      tipo,
      simIccid: tipo === "gps" ? `8956${int(1e9, 9e9)}` : null,
      estado: custodia ? "asignado" : "en_stock",
      custodiaTecnicoId: custodia,
      vehiculoId: null,
      ultimoPulso: null,
      bateria: tipo === "tag" ? 100 : null,
    });
  }

  // Folios correlativos por fecha de creación, y referencias en la bitácora
  db.ordenes.sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
  db.ordenes.forEach((o) => (o.folio = `ORD-2026-${pad(++nOrden)}`));
  db.visitas.sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
  db.visitas.forEach((v) => {
    v.folio = `VIS-2026-${pad(++nVisita)}`;
    v.ordenFolio = v.tipo === "instalacion" ? db.ordenes.find((o) => o.clienteId === v.clienteId)?.folio ?? null : null;
  });
  for (const t of db.tickets) {
    t.visitaFolio = db.visitas.find((v) => v.ticketFolio === t.folio)?.folio ?? null;
  }
  for (const e of db.eventos) {
    if (e.entidad === "orden") e.entidadRef = db.ordenes.find((o) => o.clienteId === e.clienteId)?.folio ?? "";
    if (e.entidad === "visita" && !e.entidadRef) {
      const vs = db.visitas.filter((v) => v.clienteId === e.clienteId);
      e.entidadRef = (e.tipo.startsWith("Segunda") || e.tipo.startsWith("Visita técnica") ? vs[vs.length - 1] : vs[0])?.folio ?? "";
    }
  }
  db.eventos.sort((a, b) => a.en.localeCompare(b.en));
  return db;
}
