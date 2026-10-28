/**
 * Interpretación de la consulta del buscador.
 *
 * Extrae medidas de implantes escritas en texto libre ("implante de 4.0 x 10 mm",
 * "4,0x10", "Ø4 L10", "diámetro 3,75 largo 11,5"), detecta códigos (SKU, referencia del
 * fabricante, GTIN) y deja el texto restante para la búsqueda de texto completo del servidor.
 * La tolerancia a errores de escritura la aplica el servidor (trigramas).
 */

export interface ParsedSearchQuery {
  raw: string;
  /** Texto libre restante (minúsculas, sin tildes, sin medidas ni palabras vacías). */
  text: string;
  diameterMm?: number;
  lengthMm?: number;
  /** Posible código normalizado (solo letras y dígitos, mayúsculas). */
  codeCandidate?: string;
  /** GTIN-14 si la consulta es un código de barras GS1 válido (8, 12, 13 o 14 dígitos). */
  gtin?: string;
}

/** Rangos plausibles para no confundir códigos con medidas. Incluye mini implantes y cigomáticos. */
export const DIAMETER_RANGE_MM = { min: 1.5, max: 9 } as const;
export const LENGTH_RANGE_MM = { min: 3, max: 60 } as const;

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'en', 'y', 'mm', 'x', 'por']);

/** Normaliza un código: elimina todo lo que no sea letra o dígito y pasa a mayúsculas. */
export function normalizeCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

/** Dígito verificador GS1 (GTIN-8/12/13/14, SSCC). Recibe los dígitos SIN el verificador. */
export function gs1CheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  for (let i = 0; i < digitsWithoutCheck.length; i++) {
    const digit = Number(digitsWithoutCheck[digitsWithoutCheck.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/** Rellena un GTIN válido a 14 dígitos (forma canónica para almacenar y comparar). */
export function toGtin14(code: string): string | null {
  return isValidGtin(code) ? code.padStart(14, '0') : null;
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

const NUM = '(\\d{1,2}(?:\\.\\d{1,2})?)';

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const raw = input.trim();
  const result: ParsedSearchQuery = { raw, text: '' };
  if (!raw) return result;

  let s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[×*]/g, ' x ')
    .replace(/(\d),(\d)/g, '$1.$2');

  // 1) Par diámetro × longitud: "4.0 x 10", "4x10mm", "3.5mm x 8.5 mm".
  const pair = new RegExp(`(^|[^\\w.])${NUM}\\s*(?:mm)?\\s*x\\s*${NUM}\\s*(?:mm)?(?=$|[^\\w.])`);
  const pm = pair.exec(s);
  if (pm && pm[2] && pm[3]) {
    const d = Number(pm[2]);
    const l = Number(pm[3]);
    if (inRange(d, DIAMETER_RANGE_MM) && inRange(l, LENGTH_RANGE_MM)) {
      result.diameterMm = d;
      result.lengthMm = l;
      s = s.slice(0, pm.index) + (pm[1] ?? '') + ' ' + s.slice(pm.index + pm[0].length);
    }
  }

  // 2) Marcadores explícitos: "ø4", "⌀ 4.0", "d4", "diametro 3.75".
  if (result.diameterMm === undefined) {
    const dm = new RegExp(`(?:ø|⌀|\\bdiam(?:etro)?\\.?|\\bd)\\s*:?\\s*${NUM}\\s*(?:mm)?`).exec(s);
    if (dm && dm[1] && inRange(Number(dm[1]), DIAMETER_RANGE_MM)) {
      result.diameterMm = Number(dm[1]);
      s = s.slice(0, dm.index) + ' ' + s.slice(dm.index + dm[0].length);
    }
  }
  // "l10", "largo 10", "longitud 11.5".
  if (result.lengthMm === undefined) {
    const lm = new RegExp(`(?:\\blong(?:itud)?|\\blargo|\\bl)\\s*:?\\s*${NUM}\\s*(?:mm)?`).exec(s);
    if (lm && lm[1] && inRange(Number(lm[1]), LENGTH_RANGE_MM)) {
      result.lengthMm = Number(lm[1]);
      s = s.slice(0, lm.index) + ' ' + s.slice(lm.index + lm[0].length);
    }
  }

  result.text = s
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w.\-/]+|[^\w.\-/]+$/g, ''))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .join(' ');

  // 3) Códigos: sin medidas detectadas, con al menos un dígito y forma de código.
  const hasDims = result.diameterMm !== undefined || result.lengthMm !== undefined;
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (!hasDims && /\d/.test(raw) && /^[\p{L}\d.\-/ _]{3,40}$/u.test(raw) && tokens.length <= 3) {
    const code = normalizeCode(raw);
    if (code.length >= 3) result.codeCandidate = code;
    const gtin = toGtin14(code);
    if (gtin) result.gtin = gtin;
  }

  return result;
}
