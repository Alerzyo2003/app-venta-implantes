import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { signOut } from '@/lib/auth/actions';
import { getAccessState } from '@/lib/auth/dal';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata: Metadata = { title: 'Sin acceso' };

export default async function NoAccessPage() {
  const state = await getAccessState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'mfa_pending') redirect('/mfa');
  if (state.kind === 'staff') redirect('/');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-fg">Tu cuenta no tiene acceso al panel</h1>
      <p className="text-sm text-fg-muted">
        {state.email ? <>Iniciaste sesión como <strong className="text-fg">{state.email}</strong>. </> : null}
        El panel es solo para el personal con un rol asignado. Si formas parte del equipo, pide a un administrador que te
        asigne el rol que corresponde.
      </p>
      <form action={signOut}>
        <SubmitButton variant="outline" pendingLabel="Cerrando sesión…" className="w-full">
          Cerrar sesión
        </SubmitButton>
      </form>
    </div>
  );
}
