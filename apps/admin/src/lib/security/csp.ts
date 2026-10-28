/**
 * Política de seguridad de contenido (CSP) con nonce por solicitud: solo se ejecutan los
 * scripts del propio panel. Ver node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 */
export interface CspOptions {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
  /** Solo cuando el panel se sirve por HTTPS (en local, por HTTP, rompería los recursos). */
  upgradeInsecureRequests: boolean;
}

function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, isDev, supabaseUrl, upgradeInsecureRequests }: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const extra = supabase ? [supabase] : [];
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    // React usa eval solo en desarrollo para reconstruir trazas de error.
    ['script-src', ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])]],
    // En desarrollo, la capa de errores de Next inyecta estilos sin nonce.
    ['style-src', ["'self'", isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`]],
    ['img-src', ["'self'", 'blob:', 'data:', ...extra]],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", ...extra]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];
  const policy = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  if (upgradeInsecureRequests) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** Nonce aleatorio (128 bits) en base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
