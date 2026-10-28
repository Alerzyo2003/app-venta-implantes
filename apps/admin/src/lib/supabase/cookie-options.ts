import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * El panel nunca usa Supabase desde el navegador: las cookies de sesión pueden ser HttpOnly
 * (inaccesibles para JavaScript, aun ante un XSS). Cada renovación del token (≈1 h) vuelve a
 * fijarlas, por lo que la sesión se cierra tras 12 horas sin actividad.
 */
export const SESSION_IDLE_SECONDS = 12 * 60 * 60;

export function sessionCookieOptions(env: Record<string, string | undefined> = process.env): CookieOptionsWithName {
  return {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    // Solo HTTPS en producción. ADMIN_ALLOW_INSECURE_COOKIES=1 existe para las pruebas locales
    // sobre http://127.0.0.1; nunca debe definirse en un despliegue.
    secure: env.NODE_ENV === 'production' && env.ADMIN_ALLOW_INSECURE_COOKIES !== '1',
    maxAge: SESSION_IDLE_SECONDS,
  };
}
