import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isBackendConfigured } from '@/config/env';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Cliente único de Supabase. Es null si faltan las variables de entorno: la app lo informa
 * en lugar de simular datos (principio P-02).
 */
export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
      },
      // Los reintentos los decide TanStack Query (solo errores de red, con espera acotada). Sin esto,
      // supabase-js reintenta además por su cuenta y una falla de red tardaba más de 40 s en mostrarse.
      // El tiempo máximo evita esperas indefinidas en redes móviles inestables.
      db: { retry: false, timeout: 20_000 },
    })
  : null;

/** Acceso al cliente cuando la pantalla ya verificó que el backend está configurado. */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase no está configurado (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).');
  }
  return supabase;
}

// En móviles, el refresco automático del token solo corre con la app en primer plano.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** URL pública de una imagen del catálogo en Storage (bucket "product-media"). */
export function productMediaUrl(storagePath: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/product-media/${storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
