/**
 * Variables públicas de la app (se incrustan en el bundle). Solo valores públicos:
 * la clave publicable de Supabase está pensada para el cliente; la seguridad la dan las RLS.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

/** Sin estas variables la app muestra una pantalla de configuración pendiente (no simula datos). */
export const isBackendConfigured =
  /^https?:\/\/\S+$/.test(env.supabaseUrl) && env.supabaseAnonKey.trim().length > 0;
