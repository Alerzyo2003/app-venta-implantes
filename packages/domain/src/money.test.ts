import { describe, expect, it } from 'vitest';
import { divRoundHalfUp, formatCLP, rateToBasisPoints } from './money';

describe('divRoundHalfUp', () => {
  it('redondea .5 hacia arriba', () => {
    expect(divRoundHalfUp(5950, 100)).toBe(60);
    expect(divRoundHalfUp(5949, 100)).toBe(59);
  });
  it('es exacto con divisiones enteras', () => {
    expect(divRoundHalfUp(35700, 1)).toBe(35700);
    expect(divRoundHalfUp(0, 7)).toBe(0);
  });
  it('rechaza valores negativos o no enteros', () => {
    expect(() => divRoundHalfUp(-1, 2)).toThrow();
    expect(() => divRoundHalfUp(1.5, 2)).toThrow();
    expect(() => divRoundHalfUp(1, 0)).toThrow();
  });
});

describe('rateToBasisPoints', () => {
  it('convierte 0.19 a 1900 sin error de flotante', () => {
    expect(rateToBasisPoints(0.19)).toBe(1900);
  });
  it('rechaza tasas fuera de rango', () => {
    expect(() => rateToBasisPoints(1)).toThrow();
    expect(() => rateToBasisPoints(-0.1)).toThrow();
  });
});

describe('formatCLP', () => {
  it('usa punto como separador de miles y sin decimales', () => {
    expect(formatCLP(12990)).toBe('$12.990');
    expect(formatCLP(1234567)).toBe('$1.234.567');
    expect(formatCLP(0)).toBe('$0');
  });
  it('maneja negativos y valores no finitos', () => {
    expect(formatCLP(-5000)).toBe('-$5.000');
    expect(formatCLP(Number.NaN)).toBe('—');
  });
});
