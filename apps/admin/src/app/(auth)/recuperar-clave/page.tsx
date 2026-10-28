import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetRequestForm } from './reset-request-form';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-fg">Recuperar contraseña</h1>
        <p className="text-sm text-fg-muted">Te enviaremos un enlace para crear una nueva contraseña.</p>
      </div>
      <ResetRequestForm />
      <Link href="/login" className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
