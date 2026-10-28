import type { SignUpData } from '@repo/domain';
import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import { getSupabase } from '@/lib/supabase';

export interface LegalVersions {
  terms?: string;
  privacy?: string;
}

/** URL a la que vuelven los enlaces de los correos (verificación y recuperación). */
export const authRedirect = (path: string) => Linking.createURL(path);

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ input, legal }: { input: SignUpData; legal: LegalVersions }) => {
      const { data, error } = await getSupabase().auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: authRedirect('/iniciar-sesion'),
          // El servidor valida estos datos y nunca otorga roles ni verificación por ellos.
          data: {
            full_name: input.fullName,
            phone: input.phone,
            account_type: input.accountType,
            accepted_terms_version: legal.terms,
            accepted_privacy_version: legal.privacy,
            marketing_email: input.marketingEmail,
            marketing_whatsapp: input.marketingWhatsapp,
            marketing_push: input.marketingPush,
          },
        },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: authRedirect('/nueva-clave'),
      });
      if (error) throw error;
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
    },
  });
}

/** scope 'global' cierra la sesión en todos los dispositivos (CTA-11). */
export function useSignOut() {
  return useMutation({
    mutationFn: async (scope: 'local' | 'global' = 'local') => {
      const { error } = await getSupabase().auth.signOut({ scope });
      if (error) throw error;
    },
  });
}

/**
 * Completa la sesión a partir del enlace del correo: flujo PKCE (?code=) o
 * tokens en el fragmento (#access_token=…&refresh_token=…).
 */
export async function completeSessionFromUrl(url: string): Promise<boolean> {
  const client = getSupabase();
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return true;
  }
  return false;
}
