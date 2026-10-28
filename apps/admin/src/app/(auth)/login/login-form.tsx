'use client';

import { useActionState } from 'react';

import { TextInput } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { signIn } from '@/lib/auth/actions';
import { formKey, IDLE } from '@/lib/forms';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, IDLE);
  return (
    <form key={formKey(state)} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <TextInput
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={state.values?.email}
        required
        error={state.fieldErrors?.email}
      />
      <TextInput
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Ingresando…">Ingresar</SubmitButton>
    </form>
  );
}
