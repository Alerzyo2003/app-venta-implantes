import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { supabaseEnv } from '@/lib/env';
import { sessionCookieOptions } from '@/lib/supabase/cookie-options';

/**
 * Cliente de Supabase con la sesión del usuario (cookies). Todas las consultas pasan por RLS.
 * Se crea uno por solicitud.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Un Server Component no puede escribir cookies: el proxy ya refrescó la sesión.
        }
      },
    },
    // En el servidor se falla rápido (sin reintentos automáticos) y con tiempo máximo:
    // la pantalla ofrece reintentar.
    db: { retry: false, timeout: 15_000 },
  });
}
