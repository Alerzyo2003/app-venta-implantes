/**
 * Teléfonos chilenos. Desde 2016 todos los números nacionales tienen 9 dígitos:
 * móviles con prefijo 9 y fijos con código de área (2 en Santiago, 3x–7x en regiones).
 */

/** Normaliza a E.164 (+56XXXXXXXXX). Devuelve null si no es un número chileno válido. */
export function normalizeChileanPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith('56')) digits = digits.slice(2);
  if (!/^[2-9]\d{8}$/.test(digits)) return null;
  return `+56${digits}`;
}

export function isChileanMobile(e164: string): boolean {
  return /^\+569\d{8}$/.test(e164);
}

/** "+56912345678" → "+56 9 1234 5678"; fijos: "+56 2 2345 6789". */
export function formatChileanPhone(input: string): string {
  const e164 = normalizeChileanPhone(input);
  if (!e164) return input;
  const n = e164.slice(3);
  return `+56 ${n.slice(0, 1)} ${n.slice(1, 5)} ${n.slice(5)}`;
}
