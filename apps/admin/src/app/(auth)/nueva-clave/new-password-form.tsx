'use client';

import { useActionState } from 'react';

import { TextInput } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { updatePassword } from '@/lib/auth/actions';
import { formKey, IDLE } from '@/lib/forms';

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, IDLE);
  return (
    <form key={formKey(state)} action={action} className="flex flex-col gap-4" noValidate>
      <TextInput
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
      />
      <TextInput
        label="Repite la contraseña"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
