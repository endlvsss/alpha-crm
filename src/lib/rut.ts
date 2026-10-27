// RUT chileno: cuerpo numérico + dígito verificador (módulo 11).

function clean(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function computeDv(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  if (result === 11) return "0";
  if (result === 10) return "K";
  return String(result);
}

export function isValidRut(value: string): boolean {
  const raw = clean(value);
  if (raw.length < 2) return false;
  const body = raw.slice(0, -1);
  const dv = raw.slice(-1);
  if (!/^\d{6,8}$/.test(body)) return false;
  return computeDv(body) === dv;
}

/** Formatea mientras se escribe: 12.345.678-5 */
export function formatRut(value: string): string {
  const raw = clean(value).slice(0, 9);
  if (raw.length <= 1) return raw;
  const body = raw.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${raw.slice(-1)}`;
}

/** Solo dígitos y K, para comparar RUT escritos con o sin puntos y guion. */
export function normalizeRut(value: string): string {
  return clean(value);
}
