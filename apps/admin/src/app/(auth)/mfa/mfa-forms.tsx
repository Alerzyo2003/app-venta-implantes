'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';
import { Alert, FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { startTotpEnrollment, verifyTotp, type EnrollState } from '@/lib/auth/actions';
import { formKey, IDLE } from '@/lib/forms';

function CodeForm({ factorId, next, submitLabel }: { factorId: string; next: string; submitLabel: string }) {
  const [state, action] = useActionState(verifyTotp, IDLE);
  return (
    <form key={formKey(state)} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="next" value={next} />
      <TextInput
        label="Código de verificación"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        error={state.fieldErrors?.code}
        className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.4em]"
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Verificando…">{submitLabel}</SubmitButton>
    </form>
  );
}

export function MfaChallengeForm({ factorId, next }: { factorId: string; next: string }) {
  return <CodeForm factorId={factorId} next={next} submitLabel="Verificar" />;
}

const ENROLL_IDLE: EnrollState = { status: 'idle' };

export function MfaEnrollFlow({ next }: { next: string }) {
  const [state, action] = useActionState(startTotpEnrollment, ENROLL_IDLE);
  const [showSecret, setShowSecret] = useState(false);

  if (state.status !== 'enrolling') {
    return (
      <form action={action} className="flex flex-col gap-4">
        {state.status === 'error' && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
        <SubmitButton pendingLabel="Preparando…">Configurar verificación</SubmitButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-fg">
        <li>Abre tu aplicación de autenticación y agrega una cuenta nueva.</li>
        <li>Escanea este código QR (o ingresa la clave manualmente).</li>
        <li>Escribe el código de 6 dígitos que aparece en la aplicación.</li>
      </ol>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR en línea (data URL) generado por Supabase Auth */}
        <img src={state.qrSrc} alt="Código QR para agregar la cuenta a la aplicación de autenticación" width={192} height={192} className="rounded-lg bg-white p-2" />
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => setShowSecret((v) => !v)} aria-expanded={showSecret}>
          {showSecret ? 'Ocultar clave' : 'No puedo escanear el código'}
        </Button>
        {showSecret ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-center font-mono break-all text-fg select-all">{state.secret}</p>
        ) : null}
      </div>
      <CodeForm factorId={state.factorId} next={next} submitLabel="Activar y continuar" />
    </div>
  );
}
