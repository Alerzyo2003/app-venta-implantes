import { describe, expect, it } from 'vitest';
import { dimensionsLabel, formatCalendarDate, formatDateTime, formatMm } from './format';

describe('formatos', () => {
  it('fecha en zona horaria de Chile', () => {
    // 02:30 UTC del 29-10 corresponde al 28-10 en Chile (UTC-3).
    expect(formatDateTime('2026-10-29T02:30:00Z')).toBe('28-10-2026');
    expect(formatDateTime('2026-10-28T20:45:00Z', { withTime: true })).toBe('28-10-2026 17:45');
    expect(formatDateTime('no es fecha')).toBe('—');
  });
  it('fecha calendario sin desplazamiento horario', () => {
    expect(formatCalendarDate('2027-02-28')).toBe('28-02-2027');
  });
  it('milímetros con coma decimal', () => {
    expect(formatMm(4, 1)).toBe('4,0');
    expect(formatMm(11.5)).toBe('11,5');
    expect(formatMm(3.75)).toBe('3,75');
  });
  it('rótulo de medidas', () => {
    expect(dimensionsLabel({ diameterMm: 4, lengthMm: 10 })).toBe('Ø 4,0 × 10 mm');
    expect(dimensionsLabel({ diameterMm: 4.5 })).toBe('Ø 4,5 mm');
    expect(dimensionsLabel({ lengthMm: 13 })).toBe('L 13 mm');
    expect(dimensionsLabel({})).toBeNull();
  });
});
