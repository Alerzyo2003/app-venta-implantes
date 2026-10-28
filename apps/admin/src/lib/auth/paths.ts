/** Rutas accesibles sin sesión. El resto exige sesión (y el panel, además, rol interno y MFA). */
export const PUBLIC_PATHS = ['/login', '/recuperar-clave', '/auth/confirm'] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const INTERNAL_ORIGIN = 'http://panel.invalid';

/**
 * Destino seguro después de iniciar sesión: solo rutas internas del panel. Evita redirecciones
 * abiertas («//sitio», «https://…», «/\\sitio») y bucles hacia las páginas de acceso.
 */
export function safeNextPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL_ORIGIN) return fallback;
  if (isPublicPath(url.pathname) || url.pathname === '/mfa') return fallback;
  return `${url.pathname}${url.search}`;
}
