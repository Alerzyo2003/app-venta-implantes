import 'server-only';

import type { Permission } from '@repo/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { accessSchema, can, classifyAccess } from '@/lib/auth/access';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Capa de acceso a datos (DAL): única puerta para saber quién es el usuario y qué puede hacer.
 * Cada página y cada acción del servidor la consulta; la base de datos aplica igualmente RLS
 * y exige MFA al personal (private.has_permission).
 */
export interface StaffContext {
  userId: string;
  email: string | null;
  roles: string[];
  permissions: ReadonlySet<string>;
  supabase: SupabaseClient;
}

export type AccessState =
  | { kind: 'anonymous' }
  | { kind: 'not_staff'; email: string | null }
  | { kind: 'mfa_pending'; email: string | null }
  | { kind: 'staff'; ctx: StaffContext };

export const getAccessState = cache(async (): Promise<AccessState> => {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return { kind: 'anonymous' };

  const { data, error } = await supabase.rpc('get_my_access');
  if (error) throw error;
  const access = accessSchema.parse(data);
  const email = typeof claims.email === 'string' ? claims.email : null;

  switch (classifyAccess(access)) {
    case 'not_staff':
      return { kind: 'not_staff', email };
    case 'mfa_pending':
      return { kind: 'mfa_pending', email };
    default:
      return {
        kind: 'staff',
        ctx: { userId: claims.sub, email, roles: access.roles, permissions: new Set(access.permissions), supabase },
      };
  }
});

/** Para páginas del panel: si no corresponde, redirige al paso que falta. */
export async function requireStaff(): Promise<StaffContext> {
  const state = await getAccessState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'not_staff') redirect('/sin-acceso');
  if (state.kind === 'mfa_pending') redirect('/mfa');
  return state.ctx;
}

export type ActionAccess = { ok: true; ctx: StaffContext } | { ok: false; message: string };

/**
 * Para acciones del servidor (formularios): nunca confía en que la página ya validó el acceso,
 * porque una acción se puede invocar directamente.
 */
export async function authorizeAction(permission?: Permission): Promise<ActionAccess> {
  const state = await getAccessState();
  if (state.kind === 'anonymous') return { ok: false, message: 'Tu sesión expiró. Inicia sesión nuevamente.' };
  if (state.kind === 'not_staff') return { ok: false, message: 'Tu cuenta no tiene acceso al panel.' };
  if (state.kind === 'mfa_pending') return { ok: false, message: 'Completa la verificación en dos pasos para continuar.' };
  if (permission && !can(state.ctx, permission)) {
    return { ok: false, message: 'No tienes permiso para realizar esta acción.' };
  }
  return { ok: true, ctx: state.ctx };
}
