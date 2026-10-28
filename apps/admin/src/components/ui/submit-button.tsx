'use client';

import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { buttonClasses, type ButtonSize, type ButtonVariant } from './button';

/** Botón de envío que se bloquea mientras la acción del servidor está en curso. */
export function SubmitButton({
  children,
  pendingLabel = 'Guardando…',
  variant,
  size,
  className = '',
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={buttonClasses(variant, size, className)}>
      {pending ? (
        <>
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
