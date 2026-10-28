import type { EmailOtpType } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

import { safeNextPath } from '@/lib/auth/paths';
import { isBackendConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OTP_TYPES: readonly EmailOtpType[] = ['recovery', 'invite', 'magiclink', 'email', 'email_change', 'signup'];

/**
 * Redirección relativa: el navegador la resuelve contra el dominio real. request.url puede traer
 * el host interno del servidor (p. ej. «localhost») cuando el panel está detrás de un proxy.
 */
function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } });
}

/**
 * Destino de los enlaces de correo de Supabase Auth (recuperación de contraseña, invitaciones).
 * Admite el flujo PKCE (?code=) y el de token (?token_hash=&type=).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'));
  const fail = '/login?enlace=invalido';
  if (!isBackendConfigured()) return redirectTo(fail);

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(next);
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(next);
  }
  return redirectTo(fail);
}
