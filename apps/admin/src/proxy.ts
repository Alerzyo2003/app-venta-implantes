import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isPublicPath } from '@/lib/auth/paths';
import { isBackendConfigured, supabaseEnv } from '@/lib/env';
import { buildCsp, createNonce } from '@/lib/security/csp';

/**
 * Se ejecuta antes de cada página: fija la CSP con nonce, refresca la sesión de Supabase
 * (cookies) y envía a /login a quien no tiene sesión. Es solo un control optimista: cada página
 * y acción vuelve a validar el acceso (src/lib/auth/dal.ts) y la base aplica RLS.
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: supabaseEnv.url,
    upgradeInsecureRequests: request.nextUrl.protocol === 'https:',
  });

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();

  if (isBackendConfigured()) {
    const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, cacheHeaders) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = forward();
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          // Respuestas que fijan cookies de sesión no deben quedar en cachés intermedias.
          for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
        },
      },
    });
    // Valida el token y, si venció, lo renueva con el refresh token.
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims && !isPublicPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      if (next !== '/') url.searchParams.set('next', next);
      const redirect = NextResponse.redirect(url);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      redirect.headers.set('Content-Security-Policy', csp);
      return redirect;
    }
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Todo excepto archivos estáticos y precargas del enrutador (no necesitan CSP ni sesión).
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
