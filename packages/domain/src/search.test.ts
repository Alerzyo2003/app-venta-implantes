import { describe, expect, it } from 'vitest';
import { isValidGtin, normalizeCode, parseSearchQuery, toGtin14 } from './search';

describe('parseSearchQuery — medidas', () => {
  it.each([
    ['implante de 4.0 x 10 mm', 4, 10, 'implante'],
    ['Implante 4,0x10', 4, 10, 'implante'],
    ['3.5mm x 8.5mm', 3.5, 8.5, ''],
    ['4 × 11,5 cónico', 4, 11.5, 'conico'],
    ['Ø4.0 L10', 4, 10, ''],
    ['diámetro 3,75 largo 11,5', 3.75, 11.5, ''],
    ['implante cigomático 4.0 x 45', 4, 45, 'implante cigomatico'],
  ])('"%s" → Ø%s × %s, texto "%s"', (q, d, l, text) => {
    const r = parseSearchQuery(q);
    expect(r.diameterMm).toBe(d);
    expect(r.lengthMm).toBe(l);
    expect(r.text).toBe(text);
    expect(r.codeCandidate).toBeUndefined();
  });

  it('acepta solo diámetro o solo longitud con marcador', () => {
    expect(parseSearchQuery('pilar ø 4.5')).toMatchObject({ diameterMm: 4.5, text: 'pilar' });
    expect(parseSearchQuery('implante largo 13')).toMatchObject({ lengthMm: 13, text: 'implante' });
  });

  it('no interpreta como medida valores fuera de rango', () => {
    const r = parseSearchQuery('10 x 4');
    expect(r.diameterMm).toBeUndefined();
    expect(r.lengthMm).toBeUndefined();
  });

  it('no confunde códigos con medidas', () => {
    const r = parseSearchQuery('123x456');
    expect(r.diameterMm).toBeUndefined();
    expect(r.codeCandidate).toBe('123X456');
  });
});

describe('parseSearchQuery — texto y códigos', () => {
  it('texto sin dígitos no genera código', () => {
    const r = parseSearchQuery('Pilar recto para la plataforma');
    expect(r.text).toBe('pilar recto plataforma');
    expect(r.codeCandidate).toBeUndefined();
  });

  it('detecta códigos ignorando separadores', () => {
    expect(parseSearchQuery('IMP-40.10').codeCandidate).toBe('IMP4010');
    expect(parseSearchQuery('ab 123 x9').codeCandidate).toBe('AB123X9');
  });

  it('detecta GTIN válidos y los lleva a 14 dígitos', () => {
    const r = parseSearchQuery('4006381333931');
    expect(r.gtin).toBe('04006381333931');
    expect(r.codeCandidate).toBe('4006381333931');
  });

  it('consulta vacía', () => {
    expect(parseSearchQuery('   ')).toEqual({ raw: '', text: '' });
  });
});

describe('códigos', () => {
  it('normalizeCode quita separadores y tildes', () => {
    expect(normalizeCode(' imp-40.10 á/b ')).toBe('IMP4010AB');
  });
  it('valida dígito verificador GTIN', () => {
    expect(isValidGtin('4006381333931')).toBe(true);
    expect(isValidGtin('4006381333932')).toBe(false);
    expect(isValidGtin('04006381333931')).toBe(true);
    expect(isValidGtin('12345')).toBe(false);
    expect(toGtin14('4006381333932')).toBeNull();
  });
});
