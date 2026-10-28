/** Formatos de presentación para Chile (es-CL, zona horaria America/Santiago). */

export const APP_TIME_ZONE = 'America/Santiago';

function partsOf(date: Date, withTime: boolean): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  });
  const out: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** Fecha (y hora opcional) en zona horaria de Chile: "28-10-2026" o "28-10-2026 17:45". */
export function formatDateTime(value: string | Date, options: { withTime?: boolean } = {}): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const p = partsOf(date, options.withTime ?? false);
  const day = `${p.day}-${p.month}-${p.year}`;
  return options.withTime ? `${day} ${p.hour}:${p.minute}` : day;
}

/** Fecha calendario sin hora (AAAA-MM-DD, p. ej. vencimiento de lote) → "DD-MM-AAAA". */
export function formatCalendarDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '—';
}

/** Milímetros con coma decimal: 4 → "4,0" (minDecimals 1), 11.5 → "11,5". */
export function formatMm(value: number, minDecimals = 0): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Rótulo de medidas de una variante: "Ø 4,0 × 10 mm", "Ø 4,0 mm" o "L 10 mm". */
export function dimensionsLabel(d: {
  diameterMm?: number | null;
  lengthMm?: number | null;
}): string | null {
  const hasD = typeof d.diameterMm === 'number';
  const hasL = typeof d.lengthMm === 'number';
  if (hasD && hasL) return `Ø ${formatMm(d.diameterMm!, 1)} × ${formatMm(d.lengthMm!)} mm`;
  if (hasD) return `Ø ${formatMm(d.diameterMm!, 1)} mm`;
  if (hasL) return `L ${formatMm(d.lengthMm!)} mm`;
  return null;
}
