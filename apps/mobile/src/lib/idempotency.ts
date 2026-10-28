import * as Crypto from 'expo-crypto';

/** Clave de idempotencia para operaciones que no deben duplicarse (por ejemplo, crear un pedido). */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}
