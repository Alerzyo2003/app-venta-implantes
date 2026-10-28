import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Alert } from '@/components/ui/feedback';
import { getAccessState } from '@/lib/auth/dal';
import { safeNextPath } from '@/lib/auth/paths';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const state = await getAccessState();
  if (state.kind === 'staff') redirect(next);
  if (state.kind === 'mfa_pending') redirect(`/mfa?next=${encodeURIComponent(next)}`);
  if (state.kind === 'not_staff') redirect('/sin-acceso');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-fg">Iniciar sesión</h1>
        <p className="text-sm text-fg-muted">Acceso exclusivo para el personal autorizado.</p>
      </div>
      {params.enlace === 'invalido' ? (
        <Alert tone="warning">El enlace no es válido o ya expiró. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».</Alert>
      ) : null}
      <LoginForm next={next} />
      <Link href="/recuperar-clave" className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </div>
  );
}
