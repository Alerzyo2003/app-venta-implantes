import { describe, expect, it } from 'vitest';
import { GS, gs1DateToIso, parseGs1 } from './gs1';

const NOW = new Date('2026-10-28T12:00:00Z');

describe('parseGs1', () => {
  it('interpreta el formato legible con paréntesis', () => {
    const r = parseGs1('(01)04006381333931(17)261231(10)ABC123', NOW);
    expect(r).toMatchObject({
      gtin: '04006381333931',
      gtinValid: true,
      expiryDate: '2026-12-31',
      lot: 'ABC123',
      complete: true,
    });
  });

  it('interpreta datos crudos de DataMatrix con separador GS e identificador de simbología', () => {
    const raw = `]d201040063813339311726123110ABC123${GS}21SN0001`;
    const r = parseGs1(raw, NOW);
    expect(r).toMatchObject({ gtin: '04006381333931', lot: 'ABC123', serial: 'SN0001', complete: true });
    expect(r?.expiryDate).toBe('2026-12-31');
  });

  it('interpreta datos crudos sin separador cuando el campo variable va al final', () => {
    const r = parseGs1('01040063813339311726123110LOT9', NOW);
    expect(r).toMatchObject({ lot: 'LOT9', expiryDate: '2026-12-31' });
  });

  it('interpreta GS1 Digital Link', () => {
    const r = parseGs1('https://id.gs1.org/01/04006381333931/10/ABC123?17=261231', NOW);
    expect(r).toMatchObject({ gtin: '04006381333931', lot: 'ABC123', expiryDate: '2026-12-31' });
  });

  it('marca GTIN con dígito verificador incorrecto', () => {
    expect(parseGs1('(01)04006381333932', NOW)?.gtinValid).toBe(false);
  });

  it('devuelve null para texto que no es GS1', () => {
    expect(parseGs1('hola mundo', NOW)).toBeNull();
    expect(parseGs1('', NOW)).toBeNull();
  });

  it('marca como incompleto si hay un identificador desconocido', () => {
    const r = parseGs1('0104006381333931' + '9912345', NOW);
    expect(r?.complete).toBe(false);
    expect(r?.gtin).toBe('04006381333931');
  });
});

describe('gs1DateToIso', () => {
  it('DD=00 es el último día del mes', () => {
    expect(gs1DateToIso('270200', NOW)).toBe('2027-02-28');
    expect(gs1DateToIso('280200', NOW)).toBe('2028-02-29');
  });
  it('aplica la ventana de siglo de GS1', () => {
    expect(gs1DateToIso('750101', NOW)).toBe('2075-01-01');
    expect(gs1DateToIso('800101', NOW)).toBe('1980-01-01');
  });
  it('rechaza fechas inválidas', () => {
    expect(gs1DateToIso('261301', NOW)).toBeNull();
    expect(gs1DateToIso('260231', NOW)).toBeNull();
    expect(gs1DateToIso('2612', NOW)).toBeNull();
  });
});
