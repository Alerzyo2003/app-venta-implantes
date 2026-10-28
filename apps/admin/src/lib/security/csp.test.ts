import { describe, expect, it } from 'vitest';

import { buildCsp, createNonce } from './csp';

const base = { nonce: 'abc123', isDev: false, supabaseUrl: 'https://proyecto.supabase.co', upgradeInsecureRequests: true };

describe('buildCsp', () => {
  it('en producción solo permite scripts con nonce y bloquea marcos e incrustaciones', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
  it('permite imágenes y conexiones solo al origen de Supabase (sin rutas)', () => {
    const csp = buildCsp({ ...base, supabaseUrl: 'https://proyecto.supabase.co/rest/v1' });
    expect(csp).toContain("img-src 'self' blob: data: https://proyecto.supabase.co;");
    expect(csp).toContain("connect-src 'self' https://proyecto.supabase.co;");
  });
  it('sin URL válida de Supabase no agrega orígenes externos', () => {
    const csp = buildCsp({ ...base, supabaseUrl: '' });
    expect(csp).toContain("connect-src 'self';");
  });
  it('en desarrollo relaja eval y estilos en línea; sin HTTPS no fuerza la actualización', () => {
    const csp = buildCsp({ ...base, isDev: true, upgradeInsecureRequests: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});

describe('createNonce', () => {
  it('genera valores base64 de 128 bits distintos', () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
