import { describe, expect, it } from 'vitest';
import { formatChileanPhone, isChileanMobile, normalizeChileanPhone } from './phone';

describe('teléfonos chilenos', () => {
  it.each([
    ['+56 9 1234 5678', '+56912345678'],
    ['912345678', '+56912345678'],
    ['56912345678', '+56912345678'],
    ['(+56) 9-1234-5678', '+56912345678'],
    ['+56 2 2345 6789', '+56223456789'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizeChileanPhone(input)).toBe(expected);
  });

  it.each(['12345678', '+54 9 11 1234 5678', '0912345678', 'abc', '+56 1 2345 6789'])(
    'rechaza %s',
    (input) => {
      expect(normalizeChileanPhone(input)).toBeNull();
    },
  );

  it('distingue móviles y formatea', () => {
    expect(isChileanMobile('+56912345678')).toBe(true);
    expect(isChileanMobile('+56223456789')).toBe(false);
    expect(formatChileanPhone('912345678')).toBe('+56 9 1234 5678');
  });
});
