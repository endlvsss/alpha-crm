const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/** $12.990 */
export function clp(value: number): string {
  return clpFormatter.format(value);
}

export const SANTIAGO_TZ = "America/Santiago";

/** Fecha civil (sin hora) en formato YYYY-MM-DD. */
export type IsoDate = string;

const longDate = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const shortWeekday = new Intl.DateTimeFormat("es-CL", { weekday: "short", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" });

function isoToUtcDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "martes 21 de octubre" */
export function formatLongDate(iso: IsoDate): string {
  return longDate.format(isoToUtcDate(iso));
}

/** { weekday: "mar", day: 21, month: "oct" } */
export function dateParts(iso: IsoDate) {
  const date = isoToUtcDate(iso);
  return {
    weekday: shortWeekday.format(date).replace(".", ""),
    day: date.getUTCDate(),
    month: shortMonth.format(date).replace(".", ""),
  };
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const dateTime = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: SANTIAGO_TZ,
});

const shortDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });

/** "14 oct, 20:14" para un instante. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso)).replace(".", "");
}

/** "14 oct" para una fecha civil. */
export function formatShortDate(iso: IsoDate): string {
  return shortDate.format(isoToUtcDate(iso)).replace(".", "");
}

/** Días entre dos fechas civiles (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((isoToUtcDate(b).getTime() - isoToUtcDate(a).getTime()) / 86_400_000);
}

/** "hoy", "ayer", "hace 5 días", "en 3 días" respecto de hoy. */
export function relativeDay(iso: IsoDate, today: IsoDate): string {
  const d = daysBetween(today, iso);
  if (d === 0) return "hoy";
  if (d === -1) return "ayer";
  if (d === 1) return "mañana";
  return d < 0 ? `hace ${-d} días` : `en ${d} días`;
}
