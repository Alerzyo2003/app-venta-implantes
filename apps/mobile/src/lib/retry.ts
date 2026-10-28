import { toAppError } from '@repo/domain';

/** Solo se reintentan errores transitorios (red); los de negocio o permisos no. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return toAppError(error).code === 'NETWORK' && failureCount < 3;
}

/** Espera exponencial entre reintentos: 1 s, 2 s, 4 s… con un máximo de 8 s. */
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}
