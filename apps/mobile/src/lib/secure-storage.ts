/**
 * Almacenamiento seguro para la sesión de Supabase Auth (Keychain en iOS, Keystore en Android).
 * expo-secure-store limita el tamaño por valor, por lo que la sesión se divide en fragmentos.
 * En web (solo pruebas/visualización) se usa localStorage.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const CHUNK_SIZE = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = {
  // Permite refrescar el token en segundo plano después del primer desbloqueo.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** SecureStore solo admite claves alfanuméricas, ".", "-" y "_". */
export function storageKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const isWeb = Platform.OS === 'web';

async function removeChunks(base: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${base}.count`, OPTIONS);
  const count = countRaw ? Number(countRaw) : 0;
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${base}.${i}`, OPTIONS);
  }
  await SecureStore.deleteItemAsync(`${base}.count`, OPTIONS);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    const base = storageKey(key);
    const countRaw = await SecureStore.getItemAsync(`${base}.count`, OPTIONS);
    if (countRaw === null) return null;
    const count = Number(countRaw);
    if (!Number.isInteger(count) || count < 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${base}.${i}`, OPTIONS);
      if (part === null) return null; // sesión incompleta: se trata como inexistente
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    const base = storageKey(key);
    await removeChunks(base);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${base}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), OPTIONS);
    }
    // El contador se escribe al final: una escritura interrumpida no deja una sesión corrupta legible.
    await SecureStore.setItemAsync(`${base}.count`, String(count), OPTIONS);
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await removeChunks(storageKey(key));
  },
};
