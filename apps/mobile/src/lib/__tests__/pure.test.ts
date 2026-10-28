import { addRecent, MAX_RECENT } from '../recent-searches';
import { retryDelay, shouldRetry } from '../retry';
import { compareVersions, isBelowMinimum } from '../version';

jest.mock('@react-native-async-storage/async-storage', () => ({}));

describe('búsquedas recientes', () => {
  it('agrega al inicio, sin duplicados (sin distinguir mayúsculas) y con límite', () => {
    let list: string[] = [];
    for (let i = 0; i < MAX_RECENT + 3; i++) list = addRecent(list, `t${i}`);
    expect(list).toHaveLength(MAX_RECENT);
    expect(addRecent(['Implante', 'pilar'], 'implante')).toEqual(['implante', 'pilar']);
    expect(addRecent(['a'], '   ')).toEqual(['a']);
  });
});

describe('versiones', () => {
  it('compara versiones semánticas', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1')).toBe(0);
    expect(isBelowMinimum('0.1.0', '0.2.0')).toBe(true);
    expect(isBelowMinimum('0.2.0', undefined)).toBe(false);
  });
});

describe('reintentos de consultas', () => {
  it('reintenta solo errores de red y hasta 3 veces', () => {
    const network = new TypeError('Network request failed');
    expect(shouldRetry(0, network)).toBe(true);
    expect(shouldRetry(2, network)).toBe(true);
    expect(shouldRetry(3, network)).toBe(false);
    expect(shouldRetry(0, { message: 'AbortError: signal is aborted without reason' })).toBe(true);
  });

  it('no reintenta errores de negocio ni de permisos', () => {
    expect(shouldRetry(0, { code: 'P0001', message: 'OUT_OF_STOCK' })).toBe(false);
    expect(shouldRetry(0, { code: '42501', message: 'permission denied for table orders' })).toBe(false);
  });

  it('espera de forma exponencial con un máximo de 8 s', () => {
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 8000]);
  });
});
