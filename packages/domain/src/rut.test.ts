import { describe, expect, it } from 'vitest';
import { cleanRut, computeRutDv, formatRut, isValidRut, normalizeRut } from './rut';

describe('RUT', () => {
  it('calcula el dígito verificador (módulo 11)', () => {
    expect(computeRutDv('12345678')).toBe('5');
    expect(computeRutDv('30686957')).toBe('4');
    expect(computeRutDv('11111111')).toBe('1');
    expect(computeRutDv('6')).toBe('K');
    expect(computeRutDv('14')).toBe('0');
  });

  it.each([
    ['12.345.678-5', true],
    ['12345678-5', true],
    ['123456785', true],
    ['30.686.957-4', true],
    ['6-K', true],
    ['6-k', true],
    ['14-0', true],
    ['12.345.678-4', false],
    ['', false],
    ['abc', false],
    ['1.234.567.890-1', false],
  ])('isValidRut(%s) = %s', (input, expected) => {
    expect(isValidRut(input)).toBe(expected);
  });

  it('formatea con puntos y guion', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
    expect(formatRut('6k')).toBe('6-K');
    expect(formatRut('306869574')).toBe('30.686.957-4');
  });

  it('normaliza para almacenar y rechaza inválidos', () => {
    expect(normalizeRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeRut('012.345.678-5')).toBe('12345678-5');
    expect(normalizeRut('12.345.678-4')).toBeNull();
  });

  it('limpia separadores', () => {
    expect(cleanRut(' 12.345.678-k ')).toBe('12345678K');
  });
});
