// Reglas de agenda (especificación de instaladores, sección 7): bloques de 2 h,
// cupo diario por técnico, cobertura por comuna y sin doble reserva.

import type { Db } from "@/data/seed";
import { BLOQUES } from "@/data/seed";
import { addDays } from "@/data/seed";
import type { IsoDate } from "@/lib/format";
import type { Tecnico, Visita } from "./types";
import { VISITA_ACTIVA } from "./labels";

/** Horizonte de reserva propuesto (21 días, a validar con Operaciones). */
export const HORIZONTE_DIAS = 21;

export function diaSemana(fecha: IsoDate): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

/** Visitas que ocupan al técnico ese día (no cuentan canceladas ni cerradas con falla). */
function ocupadas(db: Db, tecnicoId: string, fecha: IsoDate, excluirFolio?: string): Visita[] {
  return db.visitas.filter(
    (v) =>
      v.tecnicoId === tecnicoId &&
      v.fecha === fecha &&
      v.folio !== excluirFolio &&
      (VISITA_ACTIVA.includes(v.estado) || v.estado === "cerrada_ok"),
  );
}

export type MotivoNoDisponible = "inactivo" | "sin_cobertura" | "no_atiende" | "ocupado" | "cupo_lleno" | "fecha_invalida";

export const MOTIVO_NO_DISPONIBLE: Record<MotivoNoDisponible, string> = {
  inactivo: "El técnico no está activo",
  sin_cobertura: "El técnico no cubre esa comuna",
  no_atiende: "El técnico no atiende ese día o bloque",
  ocupado: "El bloque ya está reservado",
  cupo_lleno: "El técnico completó su cupo de ese día",
  fecha_invalida: "Fecha fuera del horizonte o en domingo",
};

/** Por qué un técnico no puede tomar un bloque, o null si puede. */
export function motivoNoDisponible(
  db: Db,
  tecnico: Tecnico,
  comuna: string,
  fecha: IsoDate,
  bloque: string,
  excluirFolio?: string,
): MotivoNoDisponible | null {
  if (tecnico.estado !== "activo") return "inactivo";
  if (fecha < db.hoy || fecha > addDays(db.hoy, HORIZONTE_DIAS) || diaSemana(fecha) === 0) return "fecha_invalida";
  if (!tecnico.comunas.includes(comuna)) return "sin_cobertura";
  if (!tecnico.disponibilidad[diaSemana(fecha)]?.includes(bloque)) return "no_atiende";
  const delDia = ocupadas(db, tecnico.id, fecha, excluirFolio);
  if (delDia.some((v) => v.bloque === bloque)) return "ocupado";
  if (delDia.length >= tecnico.cupoDiario) return "cupo_lleno";
  return null;
}

export interface BloqueLibre {
  fecha: IsoDate;
  bloque: string;
  tecnicos: Tecnico[];
}

/** Bloques con al menos un técnico compatible y libre, desde hoy y dentro del horizonte. */
export function bloquesDisponibles(db: Db, comuna: string, excluirFolio?: string): BloqueLibre[] {
  const out: BloqueLibre[] = [];
  for (let i = 0; i <= HORIZONTE_DIAS; i++) {
    const fecha = addDays(db.hoy, i);
    if (diaSemana(fecha) === 0) continue;
    for (const bloque of BLOQUES) {
      const tecnicos = db.tecnicos.filter((t) => motivoNoDisponible(db, t, comuna, fecha, bloque, excluirFolio) === null);
      if (tecnicos.length) out.push({ fecha, bloque, tecnicos: ordenarPorCarga(db, tecnicos, fecha) });
    }
  }
  return out;
}

/** El de menor carga ese día primero, para repartir el trabajo. */
function ordenarPorCarga(db: Db, tecnicos: Tecnico[], fecha: IsoDate): Tecnico[] {
  return [...tecnicos].sort((a, b) => ocupadas(db, a.id, fecha).length - ocupadas(db, b.id, fecha).length);
}

/** ¿Hay algún técnico activo que cubra la comuna? */
export function comunaConCobertura(db: Db, comuna: string): boolean {
  return db.tecnicos.some((t) => t.estado === "activo" && t.comunas.includes(comuna));
}
