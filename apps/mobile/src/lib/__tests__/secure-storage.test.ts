import { CHUNK_SIZE, secureStorage, storageKey } from '../secure-storage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  getItemAsync: jest.fn(async (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockStore.delete(k);
  }),
}));

describe('secureStorage (sesión cifrada en fragmentos)', () => {
  beforeEach(() => mockStore.clear());

  it('guarda y recupera valores más largos que el límite por fragmento', async () => {
    const value = 'x'.repeat(CHUNK_SIZE * 2 + 17);
    await secureStorage.setItem('sb-proyecto-auth-token', value);
    expect(mockStore.get(`${storageKey('sb-proyecto-auth-token')}.count`)).toBe('3');
    expect(await secureStorage.getItem('sb-proyecto-auth-token')).toBe(value);
  });

  it('al reemplazar, elimina fragmentos sobrantes', async () => {
    await secureStorage.setItem('k', 'a'.repeat(CHUNK_SIZE * 3));
    await secureStorage.setItem('k', 'corto');
    expect(mockStore.get('k.count')).toBe('1');
    expect(mockStore.has('k.2')).toBe(false);
    expect(await secureStorage.getItem('k')).toBe('corto');
  });

  it('una sesión incompleta se trata como inexistente', async () => {
    await secureStorage.setItem('k', 'b'.repeat(CHUNK_SIZE * 2));
    mockStore.delete('k.1');
    expect(await secureStorage.getItem('k')).toBeNull();
  });

  it('removeItem borra todos los fragmentos', async () => {
    await secureStorage.setItem('k', 'c'.repeat(CHUNK_SIZE + 1));
    await secureStorage.removeItem('k');
    expect([...mockStore.keys()]).toEqual([]);
  });

  it('normaliza claves no admitidas por SecureStore', () => {
    expect(storageKey('sb:proyecto/auth token')).toBe('sb_proyecto_auth_token');
  });
});
