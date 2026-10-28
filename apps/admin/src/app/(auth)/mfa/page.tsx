import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Alert } from '@/components/ui/feedback';
import { signOut } from '@/lib/auth/actions';
import { getAccessState } from '@/lib/auth/dal';
import { safeNextPath } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { MfaChallengeForm, MfaEnrollFlow } from './mfa-forms';

export const metadata: Metadata = { title: 'Verificación en dos pasos' };

export default async function MfaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const state = await getAccessState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'not_staff') redirect('/sin-acceso');
  if (state.kind === 'staff') redirect(next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  // Solo los factores TOTP verificados permiten elevar la sesión.
  const factor = data?.totp[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-fg">Verificación en dos pasos</h1>
        <p className="text-sm text-fg-muted">
          {factor
            ? 'Ingresa el código de 6 dígitos que muestra tu aplicación de autenticación.'
            : 'El personal debe proteger su cuenta con una aplicación de autenticación (Google Authenticator, Microsoft Authenticator, 1Password u otra compatible con TOTP).'}
        </p>
      </div>
      {error ? (
        <Alert tone="danger">No pudimos consultar tus métodos de verificación. Recarga la página.</Alert>
      ) : factor ? (
        <MfaChallengeForm factorId={factor.id} next={next} />
      ) : (
        <MfaEnrollFlow next={next} />
      )}
      <form action={signOut}>
        <button type="submit" className="w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
