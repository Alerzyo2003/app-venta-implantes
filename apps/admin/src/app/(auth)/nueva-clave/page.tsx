import { PASSWORD_MIN_LENGTH } from '@repo/domain';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getAccessState } from '@/lib/auth/dal';

import { NewPasswordForm } from './new-password-form';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default async function NewPasswordPage() {
  // Se llega con la sesión temporal que abre el enlace del correo.
  const state = await getAccessState();
  if (state.kind === 'anonymous') redirect('/recuperar-clave');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-fg">Crea una nueva contraseña</h1>
        <p className="text-sm text-fg-muted">
          Mínimo {PASSWORD_MIN_LENGTH} caracteres, con letras y números. No reutilices contraseñas de otros servicios.
        </p>
      </div>
      <NewPasswordForm />
    </div>
  );
}
