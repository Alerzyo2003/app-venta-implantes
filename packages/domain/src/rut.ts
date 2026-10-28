/**
 * RUT chileno: limpieza, cálculo del dígito verificador (módulo 11), validación y formato.
 * La base de datos tiene una función equivalente (`private.is_valid_rut`).
 */

/** Elimina puntos, guiones y espacios; pasa a mayúsculas. "12.345.678-k" → "12345678K". */
export function cleanRut(input: string): string {
  return input.replace(/[.\-\s]/g, '').toUpperCase();
}

/** Calcula el dígito verificador para el cuerpo numérico del RUT. */
export function computeRutDv(body: string): string {
  if (!/^\d{1,9}$/.test(body)) throw new RangeError(`Cuerpo de RUT inválido: ${body}`);
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const dv = 11 - (sum % 11);
  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return String(dv);
}

/** Separa cuerpo y DV de un RUT limpio. Devuelve null si el formato no es válido. */
export function splitRut(input: string): { body: string; dv: string } | null {
  const clean = cleanRut(input);
  const m = /^(\d{1,12})([\dK])$/.exec(clean);
  if (!m || !m[1] || !m[2]) return null;
  const body = m[1].replace(/^0+(?=\d)/, '');
  if (body.length > 8) return null;
  return { body, dv: m[2] };
}

export function isValidRut(input: string): boolean {
  const parts = splitRut(input);
  if (!parts) return false;
  return computeRutDv(parts.body) === parts.dv;
}

/** Formato con puntos y guion: "123456785" → "12.345.678-5". Si no es parseable, lo devuelve limpio. */
export function formatRut(input: string): string {
  const parts = splitRut(input);
  if (!parts) return cleanRut(input);
  const withDots = parts.body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots}-${parts.dv}`;
}

/** Forma canónica para almacenar: cuerpo sin ceros a la izquierda + guion + DV. "12345678-5". */
export function normalizeRut(input: string): string | null {
  const parts = splitRut(input);
  if (!parts || computeRutDv(parts.body) !== parts.dv) return null;
  return `${parts.body}-${parts.dv}`;
}
