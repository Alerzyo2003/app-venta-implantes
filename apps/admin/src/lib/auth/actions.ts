'use server';

import { brand } from '@repo/brand';
import { emailSchema, passwordSchema, toAppError } from '@repo/domain';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { accessSchema, classifyAccess } from '@/lib/auth/access';
import { normalizeTotpCode, qrImageSrc } from '@/lib/auth/mfa';
import { safeNextPath } from '@/lib/auth/paths';
import { dbErrorMessage } from '@/lib/db-errors';
import { isBackendConfigured } from '@/lib/env';
import { failure, formText, formValues, invalid, success, type FormState } from '@/lib/forms';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const NOT_CONFIGURED = 'El panel aún no está conectado a Supabase. Revisa la configuración del servidor.';

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isBackendConfigured()) return failure(NOT_CONFIGURED);
  const values = formValues(formData);
  const parsed = loginSchema.safeParse({ email: formText(formData, 'email'), password: formData.get('password') ?? '' });
  if (!parsed.success) return invalid(parsed.error, values);
  const next = safeNextPath(formData.get('next'));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return failure(toAppError(error).message, values);

  const { data, error: accessError } = await supabase.rpc('get_my_access');
  if (accessError) return failure(dbErrorMessage(accessError), values);
  const kind = classifyAccess(accessSchema.parse(data));
  if (kind === 'not_staff') {
    // Las cuentas de clientes no mantienen sesión en el panel.
    await supabase.auth.signOut({ scope: 'local' });
    return failure('Esta cuenta no tiene acceso al panel. Si eres parte del equipo, pide a un administrador que te asigne un rol.');
  }
  redirect(kind === 'mfa_pending' ? `/mfa?next=${encodeURIComponent(next)}` : next);
}

export async function signOut(): Promise<void> {
  if (isBackendConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: 'local' });
  }
  redirect('/login');
}

export type EnrollState =
  | { status: 'idle' | 'error'; message?: string }
  | { status: 'enrolling'; factorId: string; qrSrc: string; secret: string };

/** Paso 1 del enrolamiento TOTP: crea el factor (sin verificar) y entrega el QR y la clave. */
export async function startTotpEnrollment(_prev: EnrollState): Promise<EnrollState> {
  if (!isBackendConfigured()) return { status: 'error', message: NOT_CONFIGURED };
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect('/login');

  // Los factores sin verificar de intentos anteriores no dan acceso: se descartan.
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { status: 'error', message: toAppError(listError).message };
  for (const factor of factors.all) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Panel ${new Date().toISOString().slice(0, 16)}`,
    issuer: brand.name,
  });
  if (error) return { status: 'error', message: toAppError(error).message };
  return { status: 'enrolling', factorId: data.id, qrSrc: qrImageSrc(data.totp.qr_code), secret: data.totp.secret };
}

/** Verifica un código TOTP: confirma el enrolamiento o eleva la sesión a aal2. */
export async function verifyTotp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isBackendConfigured()) return failure(NOT_CONFIGURED);
  const code = normalizeTotpCode(formText(formData, 'code'));
  if (!code) return { ...failure('Revisa el código.'), fieldErrors: { code: 'Ingresa los 6 dígitos que muestra tu aplicación.' } };
  const factorId = formText(formData, 'factorId');

  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return failure(toAppError(listError).message);
  if (!factors.all.some((f) => f.id === factorId && f.factor_type === 'totp')) {
    return failure('La configuración de la verificación expiró. Vuelve a empezar.');
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return failure(toAppError(error).message);
  redirect(safeNextPath(formData.get('next')));
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isBackendConfigured()) return failure(NOT_CONFIGURED);
  const parsed = z.object({ email: emailSchema }).safeParse({ email: formText(formData, 'email') });
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const supabase = await createSupabaseServerClient();
  // Supabase solo acepta destinos incluidos en su lista de URLs permitidas (Auth → URL Configuration).
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/nueva-clave`,
  });
  const appError = error ? toAppError(error) : null;
  if (appError && appError.code !== 'user_not_found') return failure(appError.message);
  // Mismo mensaje exista o no la cuenta: no se revela quién está registrado.
  return success('Si el correo pertenece a una cuenta del equipo, recibirás un enlace para crear una nueva contraseña.');
}

const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, { error: 'Las contraseñas no coinciden.', path: ['passwordConfirm'] });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isBackendConfigured()) return failure(NOT_CONFIGURED);
  const parsed = newPasswordSchema.safeParse({
    password: formData.get('password') ?? '',
    passwordConfirm: formData.get('passwordConfirm') ?? '',
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return failure('El enlace expiró. Solicita uno nuevo.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure(toAppError(error).message);
  redirect('/');
}
