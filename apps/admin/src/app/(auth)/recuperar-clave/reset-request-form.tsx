'use client';

import { useActionState } from 'react';

import { TextInput } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { requestPasswordReset } from '@/lib/auth/actions';
import { formKey, IDLE } from '@/lib/forms';

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, IDLE);
  return (
    <form key={formKey(state)} action={action} className="flex flex-col gap-4" noValidate>
      <TextInput
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
