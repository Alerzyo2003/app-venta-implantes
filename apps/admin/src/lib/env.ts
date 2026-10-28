/**
 * Configuración del servidor. Solo valores públicos de Supabase (URL y clave publicable):
 * el panel no usa la service_role; las reglas las aplican RLS y las funciones de la base.
 * Se leen en tiempo de ejecución (no se incrustan en el código del navegador).
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export const supabaseEnv: SupabaseEnv = {
  url: process.env.SUPABASE_URL ?? '',
  anonKey: process.env.SUPABASE_ANON_KEY ?? '',
};

/** Sin estas variables el panel muestra «configuración pendiente» en vez de simular datos. */
export function isBackendConfigured(env: SupabaseEnv = supabaseEnv): boolean {
  return /^https?:\/\/\S+$/.test(env.url) && env.anonKey.trim().length > 0;
}
