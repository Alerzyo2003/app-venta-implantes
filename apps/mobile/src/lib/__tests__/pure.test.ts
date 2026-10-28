import { addRecent, MAX_RECENT } from '../recent-searches';
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
