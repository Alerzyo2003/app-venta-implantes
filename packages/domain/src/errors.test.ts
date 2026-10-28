import { describe, expect, it } from 'vitest';
import { BUSINESS_ERROR_MESSAGES, toAppError } from './errors';

describe('toAppError', () => {
  it('traduce errores de negocio de las funciones SQL', () => {
    const e = toAppError({ message: 'OUT_OF_STOCK', code: 'P0001', details: 'SKU ABC', hint: null });
    expect(e).toEqual({
      code: 'OUT_OF_STOCK',
      message: BUSINESS_ERROR_MESSAGES.OUT_OF_STOCK,
      detail: 'SKU ABC',
      hint: undefined,
    });
  });

  it('traduce errores de privilegios', () => {
    expect(toAppError({ message: 'permission denied for table orders', code: '42501' }).code).toBe(
      'PERMISSION_DENIED',
    );
  });

  it('traduce errores de Supabase Auth por código', () => {
    const e = toAppError({ __isAuthError: true, name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials' });
    expect(e.message).toBe('Correo o contraseña incorrectos.');
  });

  it('traduce errores de Auth por mensaje cuando no hay código', () => {
    const e = toAppError({ __isAuthError: true, name: 'AuthApiError', message: 'Email not confirmed' });
    expect(e.code).toBe('email_not_confirmed');
  });

  it('detecta errores de red', () => {
    expect(toAppError(new TypeError('Network request failed')).code).toBe('NETWORK');
    expect(toAppError({ message: 'TypeError: Failed to fetch' }).code).toBe('NETWORK');
    expect(toAppError({ message: 'AbortError: signal is aborted without reason', hint: 'Request was aborted (timeout or manual cancellation)' }).code).toBe('NETWORK');
    expect(toAppError({ message: 'Aborted by the user in AbortError handling' }).code).toBe('UNKNOWN');
  });

  it('cae en UNKNOWN sin exponer detalles técnicos en el mensaje', () => {
    const e = toAppError({ message: 'duplicate key value violates unique constraint', code: '23505' });
    expect(e.code).toBe('UNKNOWN');
    expect(e.message).toBe(BUSINESS_ERROR_MESSAGES.UNKNOWN);
    expect(toAppError(null).code).toBe('UNKNOWN');
  });
});
