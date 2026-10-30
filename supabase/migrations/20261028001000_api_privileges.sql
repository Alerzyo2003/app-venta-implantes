-- =============================================================================
-- 1000 · Privilegios de la API: las funciones que exigen sesión no se ejecutan sin ella
--   Aviso de seguridad de Supabase 0028 (funciones SECURITY DEFINER invocables sin sesión).
--   Estas funciones ya rechazaban a los anónimos por dentro (NOT_AUTHENTICATED o
--   PERMISSION_DENIED); además, ahora PostgREST ni siquiera las ejecuta sin sesión.
--   get_variant_prices y get_availability siguen abiertas a propósito: el catálogo público las
--   usa y solo devuelven lo que la configuración permite ver.
-- =============================================================================

revoke execute on function
  public.accept_current_legal_documents(text),
  public.get_my_access(),
  public.submit_professional_verification(text, text, text, text[]),
  public.review_professional_verification(uuid, text, text),
  public.assign_role(uuid, text),
  public.revoke_role(uuid, text),
  public.set_lot_status(uuid, text, text)
from public, anon;
grant execute on function
  public.accept_current_legal_documents(text),
  public.get_my_access(),
  public.submit_professional_verification(text, text, text, text[]),
  public.review_professional_verification(uuid, text, text),
  public.assign_role(uuid, text),
  public.revoke_role(uuid, text),
  public.set_lot_status(uuid, text, text)
to authenticated, service_role;
