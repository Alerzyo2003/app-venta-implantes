'use client';

import { useActionState } from 'react';

import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { formKey, IDLE, type FormState } from '@/lib/forms';
import type { ProductStatus } from '@/lib/schemas/product';

export interface StatusTransition {
  to: ProductStatus;
  label: string;
  variant: 'primary' | 'outline' | 'danger';
  confirm?: string;
}

function TransitionButton({
  transition,
  action,
}: {
  transition: StatusTransition;
  action: (prev: FormState) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <form key={formKey(state)} action={formAction}
      onSubmit={(e) => {
        if (transition.confirm && !window.confirm(transition.confirm)) e.preventDefault();
      }}
      className="flex flex-col gap-2">
      <SubmitButton variant={transition.variant} pendingLabel="Aplicando…" className="w-full">
        {transition.label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Cambios de estado permitidos para el usuario (la base vuelve a validar permisos y reglas). */
export function ProductStatusActions({
  transitions,
  actionFor,
}: {
  transitions: StatusTransition[];
  actionFor: Record<string, (prev: FormState) => Promise<FormState>>;
}) {
  if (transitions.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {transitions.map((t) => (
        <TransitionButton key={t.to} transition={t} action={actionFor[t.to]!} />
      ))}
    </div>
  );
}
