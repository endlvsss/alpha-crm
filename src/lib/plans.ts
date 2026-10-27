// Planes de referencia (modelo de negocio GPSTracker v1, sección 5).
// Nombres, funciones y precios son PROVISORIOS: los precios se fijaron
// cerca del mercado (estudio de mercado 29-09-2026, CLP con IVA) mientras
// el equipo comercial define los valores reales.

export type PlanId = "esencial" | "seguridad" | "flota";
export type Billing = "mensual" | "anual";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  forWho: string;
  /** Mensualidad por vehículo, CLP con IVA. */
  monthly: number;
  /** Equipo + instalación por vehículo, CLP con IVA. */
  setup: number;
  setupIncludes: string;
  minVehicles: number;
  maxVehicles: number;
  recommended?: boolean;
  highlights: string[];
  /** Lo que el plan no incluye, para que nadie lo compre esperando otra cosa. */
  excludes?: string[];
}

/** Plan anual: se pagan 10 mensualidades y se usan 12. */
export const ANNUAL_MONTHS_CHARGED = 10;
export const ANNUAL_FREE_MONTHS = 12 - ANNUAL_MONTHS_CHARGED;

export const plans: Plan[] = [
  {
    id: "esencial",
    name: "Esencial",
    tagline: "Solo ubicación e historial, sin alertas.",
    forWho: "Para quien quiere ver su vehículo en el mapa y revisar sus recorridos.",
    monthly: 8990,
    setup: 59990,
    setupIncludes: "Equipo de señal principal + instalación",
    minVehicles: 1,
    maxVehicles: 1,
    highlights: [
      "Ubicación en vivo",
      "Historial de recorridos por fecha",
      "Reporte de tu vehículo",
      "Instalación a domicilio",
    ],
    excludes: ["Sin alertas ni geocercas", "Sin señal de respaldo", "Sin corte de suministro ni sirena"],
  },
  {
    id: "seguridad",
    name: "Seguridad",
    tagline: "Alertas, señal de respaldo y control a distancia.",
    forWho: "Para autos particulares y camionetas que quieren alertas y control a distancia.",
    monthly: 12990,
    setup: 89990,
    setupIncludes: "Equipos de señal principal y de respaldo + relé de corte + sirena + instalación",
    minVehicles: 1,
    maxVehicles: 1,
    recommended: true,
    highlights: [
      "Todo lo de Esencial",
      "Alertas de encendido, velocidad y zonas",
      "Señal principal y de respaldo",
      "Corte de suministro y sirena remotos",
    ],
  },
  {
    id: "flota",
    name: "Flota",
    tagline: "Varios vehículos, un solo panel.",
    forWho: "Para familias o pequeños negocios con 3 o más vehículos.",
    monthly: 10990,
    setup: 84990,
    setupIncludes: "Equipos de señal principal y de respaldo + relé de corte + sirena + instalación, por vehículo",
    minVehicles: 3,
    maxVehicles: 10,
    highlights: [
      "Todo lo de Seguridad",
      "Conductores asignados a cada vehículo",
      "Varios usuarios con roles",
      "Precio menor por vehículo",
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  const plan = plans.find((p) => p.id === id);
  if (!plan) throw new Error(`Plan desconocido: ${id}`);
  return plan;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "esencial" || value === "seguridad" || value === "flota";
}

export interface Quote {
  /** Lo que se cobra hoy: equipo + instalación + primer período. */
  dueToday: number;
  setupTotal: number;
  periodTotal: number;
  /** Mensualidad equivalente por vehículo. */
  perMonthEquivalent: number;
  /** Ahorro anual frente a pagar mes a mes (0 en mensual). */
  annualSavings: number;
  vehicles: number;
}

export function quote(plan: Plan, billing: Billing, vehicles: number): Quote {
  const n = Math.min(Math.max(vehicles, plan.minVehicles), plan.maxVehicles);
  const setupTotal = plan.setup * n;
  const annualPerVehicle = plan.monthly * ANNUAL_MONTHS_CHARGED;
  const periodTotal = billing === "anual" ? annualPerVehicle * n : plan.monthly * n;
  return {
    dueToday: setupTotal + periodTotal,
    setupTotal,
    periodTotal,
    perMonthEquivalent:
      billing === "anual" ? Math.round(annualPerVehicle / 12) : plan.monthly,
    annualSavings: billing === "anual" ? plan.monthly * ANNUAL_FREE_MONTHS * n : 0,
    vehicles: n,
  };
}

export type FeatureValue = boolean | string;

export interface FeatureRow {
  label: string;
  hint?: string;
  values: Record<PlanId, FeatureValue>;
}

export interface FeatureGroup {
  title: string;
  rows: FeatureRow[];
}

export const featureMatrix: FeatureGroup[] = [
  {
    title: "Rastreo",
    rows: [
      {
        label: "Ubicación en vivo",
        hint: "Posición, velocidad, motor y batería del GPS sobre mapa satelital.",
        values: { esencial: true, seguridad: true, flota: true },
      },
      {
        label: "Historial de recorridos",
        hint: "Ruta por rango de fechas, con hora y velocidad de cada punto.",
        values: { esencial: true, seguridad: true, flota: true },
      },
      {
        label: "Reporte del vehículo",
        values: { esencial: true, seguridad: true, flota: "Flota completa" },
      },
    ],
  },
  {
    title: "Seguridad",
    rows: [
      {
        label: "Alertas clasificadas por gravedad",
        hint: "Encendido sin autorización, exceso de velocidad y entrada o salida de zonas.",
        values: { esencial: false, seguridad: true, flota: true },
      },
      {
        label: "Geocercas",
        hint: "Dibuja zonas en el mapa y elige si avisar al entrar, al salir o ambas.",
        values: { esencial: false, seguridad: true, flota: true },
      },
      {
        label: "Señal de respaldo",
        hint: "Una segunda señal de localización, además de la principal.",
        values: { esencial: false, seguridad: true, flota: true },
      },
      {
        label: "Corte de suministro y sirena remotos",
        hint: "Cada comando queda registrado con fecha y hora.",
        values: { esencial: false, seguridad: true, flota: true },
      },
    ],
  },
  {
    title: "Gestión",
    rows: [
      {
        label: "Conductores asignados",
        hint: "Registra quién maneja cada vehículo, con RUT y contacto.",
        values: { esencial: false, seguridad: false, flota: true },
      },
      {
        label: "Varios usuarios con roles",
        values: { esencial: false, seguridad: false, flota: true },
      },
    ],
  },
  {
    title: "Servicio",
    rows: [
      {
        label: "Instalación a domicilio",
        hint: "Por ahora, solo en la Región Metropolitana.",
        values: { esencial: true, seguridad: true, flota: true },
      },
      {
        label: "Acceso web desde celular o computador",
        values: { esencial: true, seguridad: true, flota: true },
      },
      {
        label: "Ayuda por WhatsApp",
        values: { esencial: true, seguridad: true, flota: true },
      },
    ],
  },
];
