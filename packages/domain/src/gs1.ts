/**
 * Parser de códigos GS1 (UDI) presentes en envases de dispositivos médicos:
 * DataMatrix / GS1-128 (datos crudos con separador FNC1/GS), texto legible con
 * paréntesis "(01)…(17)…(10)…" y GS1 Digital Link ("https://…/01/…/10/…?17=…").
 *
 * Se usa para identificar el producto (GTIN), el lote y el vencimiento al escanear.
 * El resultado es una COINCIDENCIA PROBABLE: el usuario debe confirmarla.
 */
import { isValidGtin } from './search';

export const GS = '\u001d';

interface AiSpec {
  fixed?: number;
  max?: number;
}

/** Subconjunto de Identificadores de Aplicación relevantes para dispositivos médicos. */
const AI_TABLE: Record<string, AiSpec> = {
  '00': { fixed: 18 }, // SSCC
  '01': { fixed: 14 }, // GTIN
  '02': { fixed: 14 }, // GTIN contenido
  '10': { max: 20 }, // Lote
  '11': { fixed: 6 }, // Fecha de producción
  '13': { fixed: 6 }, // Fecha de envasado
  '15': { fixed: 6 }, // Consumir preferentemente antes de
  '16': { fixed: 6 }, // Vender antes de
  '17': { fixed: 6 }, // Vencimiento
  '21': { max: 20 }, // Serie
  '22': { max: 20 }, // Variante de producto de consumo
  '30': { max: 8 }, // Cantidad variable
  '37': { max: 8 }, // Cantidad de unidades contenidas
  '240': { max: 30 }, // Identificación adicional del producto
  '241': { max: 30 }, // Número de pieza del cliente
};

export interface Gs1Element {
  ai: string;
  value: string;
}

export interface Gs1Data {
  elements: Gs1Element[];
  gtin?: string;
  gtinValid?: boolean;
  lot?: string;
  serial?: string;
  /** Fechas en formato ISO AAAA-MM-DD. */
  expiryDate?: string;
  productionDate?: string;
  bestBeforeDate?: string;
  sscc?: string;
  quantity?: number;
  /** false si quedó una parte del código sin interpretar. */
  complete: boolean;
}

/**
 * Convierte AAMMDD a ISO usando la regla de siglo de las especificaciones generales de GS1
 * (ventana deslizante respecto del año actual). DD = 00 significa el último día del mes.
 */
export function gs1DateToIso(yymmdd: string, now: Date = new Date()): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  let dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return null;

  const currentYear = now.getUTCFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const diff = yy - (currentYear % 100);
  let year = currentCentury + yy;
  if (diff >= 51) year -= 100;
  else if (diff <= -50) year += 100;

  const lastDay = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  if (dd === 0) dd = lastDay;
  if (dd < 1 || dd > lastDay) return null;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function matchAi(data: string, pos: number): string | null {
  for (const len of [2, 3, 4]) {
    const candidate = data.slice(pos, pos + len);
    if (candidate.length === len && AI_TABLE[candidate]) return candidate;
  }
  return null;
}

function parseRaw(data: string): { elements: Gs1Element[]; complete: boolean } {
  const elements: Gs1Element[] = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] === GS) {
      i++;
      continue;
    }
    const ai = matchAi(data, i);
    if (!ai) return { elements, complete: false };
    const spec = AI_TABLE[ai]!;
    i += ai.length;
    let value: string;
    if (spec.fixed) {
      value = data.slice(i, i + spec.fixed);
      if (value.length !== spec.fixed) return { elements, complete: false };
      i += spec.fixed;
    } else {
      const gsPos = data.indexOf(GS, i);
      const end = Math.min(gsPos === -1 ? data.length : gsPos, i + (spec.max ?? 20));
      value = data.slice(i, end);
      i = end;
    }
    elements.push({ ai, value });
  }
  return { elements, complete: true };
}

function parseParenthesized(data: string): { elements: Gs1Element[]; complete: boolean } {
  const elements: Gs1Element[] = [];
  const re = /\((\d{2,4})\)([^()]*)/g;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(data)) !== null) {
    const ai = m[1] ?? '';
    elements.push({ ai, value: (m[2] ?? '').trim() });
    consumed += m[0].length;
  }
  const complete = consumed === data.replace(/\s+$/, '').length && elements.every((e) => AI_TABLE[e.ai]);
  return { elements, complete };
}

function parseDigitalLink(url: string): { elements: Gs1Element[]; complete: boolean } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  const start = segments.indexOf('01');
  if (start === -1) return null;
  const elements: Gs1Element[] = [];
  for (let i = start; i + 1 < segments.length; i += 2) {
    elements.push({ ai: segments[i]!, value: decodeURIComponent(segments[i + 1]!) });
  }
  parsed.searchParams.forEach((value, key) => {
    if (/^\d{2,4}$/.test(key)) elements.push({ ai: key, value });
  });
  return { elements, complete: elements.every((e) => AI_TABLE[e.ai]) };
}

/** Interpreta un código GS1. Devuelve null si el texto no parece GS1. */
export function parseGs1(input: string, now: Date = new Date()): Gs1Data | null {
  let data = input.trim();
  if (!data) return null;

  let parsed: { elements: Gs1Element[]; complete: boolean } | null = null;
  if (/^https?:\/\//i.test(data)) {
    parsed = parseDigitalLink(data);
  } else if (data.startsWith('(')) {
    parsed = parseParenthesized(data);
  } else {
    // Identificadores de simbología: ]d2 DataMatrix, ]C1 GS1-128, ]e0 DataBar, ]Q3 QR GS1.
    data = data.replace(/^\][A-Za-z]\d/, '');
    if (data.startsWith(GS)) data = data.slice(1);
    if (!/^(00|01|02)\d/.test(data)) return null;
    parsed = parseRaw(data);
  }
  if (!parsed || parsed.elements.length === 0) return null;

  const result: Gs1Data = { elements: parsed.elements, complete: parsed.complete };
  for (const { ai, value } of parsed.elements) {
    switch (ai) {
      case '01':
      case '02':
        result.gtin = value;
        result.gtinValid = isValidGtin(value);
        break;
      case '10':
        result.lot = value;
        break;
      case '21':
        result.serial = value;
        break;
      case '17':
        result.expiryDate = gs1DateToIso(value, now) ?? undefined;
        break;
      case '11':
        result.productionDate = gs1DateToIso(value, now) ?? undefined;
        break;
      case '15':
        result.bestBeforeDate = gs1DateToIso(value, now) ?? undefined;
        break;
      case '00':
        result.sscc = value;
        break;
      case '30':
      case '37':
        result.quantity = /^\d+$/.test(value) ? Number(value) : undefined;
        break;
      default:
        break;
    }
  }
  return result;
}
