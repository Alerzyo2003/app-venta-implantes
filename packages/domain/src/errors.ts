/**
 * Códigos de error de negocio devueltos por las funciones SQL (RAISE ... message = 'CÓDIGO')
 * y por Supabase Auth, traducidos a mensajes en español para la interfaz.
 */

export const BUSINESS_ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Debes iniciar sesión para continuar.',
  EMAIL_NOT_CONFIRMED: 'Confirma tu correo electrónico para poder comprar.',
  PERMISSION_DENIED: 'No tienes permiso para realizar esta acción.',
  MFA_REQUIRED: 'Esta acción requiere verificación en dos pasos.',
  IDEMPOTENCY_KEY_REQUIRED: 'La solicitud no es válida. Intenta nuevamente.',
  CART_EMPTY: 'Tu carrito está vacío.',
  INVALID_QUANTITY: 'La cantidad no es válida.',
  ITEM_UNAVAILABLE: 'Uno de los productos ya no está disponible.',
  PROFESSIONAL_VERIFICATION_REQUIRED:
    'Este producto se vende solo a profesionales con verificación aprobada.',
  PRICE_NOT_AVAILABLE: 'Uno de los productos no tiene un precio vigente. Contacta a un asesor.',
  PRICE_CHANGED: 'Los precios o costos cambiaron. Revisa el nuevo total antes de confirmar.',
  OUT_OF_STOCK: 'No hay stock suficiente para uno de los productos.',
  ADDRESS_REQUIRED: 'Selecciona una dirección de despacho.',
  ADDRESS_NOT_FOUND: 'La dirección seleccionada no existe.',
  SHIPPING_METHOD_NOT_AVAILABLE: 'La modalidad de despacho no está disponible.',
  SHIPPING_NOT_AVAILABLE: 'No hay cobertura de despacho para la comuna seleccionada.',
  BILLING_REQUIRED: 'Para emitir factura debes ingresar datos de facturación válidos.',
  INVALID_DOCUMENT_TYPE: 'El tipo de documento no es válido.',
  ORDER_NOT_FOUND: 'No encontramos el pedido.',
  ORDER_NOT_CANCELLABLE: 'Este pedido ya no se puede cancelar.',
  INVALID_STATUS_TRANSITION: 'Ese cambio de estado no está permitido.',
  PAYMENT_NOT_FOUND: 'No encontramos el pago.',
  PAYMENT_AMOUNT_MISMATCH: 'El monto del pago no coincide con el pedido.',
  INVALID_PAYMENT_TRANSITION: 'Ese cambio de estado del pago no está permitido.',
  INSUFFICIENT_STOCK: 'El movimiento dejaría el stock en negativo o bajo lo reservado.',
  LOT_REQUIRED: 'Este producto requiere número de lote.',
  EXPIRY_REQUIRED: 'Este producto requiere fecha de vencimiento.',
  INVALID_RUT: 'El RUT no es válido.',
  ACCOUNT_HAS_OPEN_ORDERS: 'No puedes eliminar tu cuenta mientras tengas pedidos en curso.',
  EVIDENCE_REQUIRED: 'Para verificar una compatibilidad debes indicar la fuente técnica.',
  REASON_REQUIRED: 'Debes indicar un motivo.',
  TERMS_NOT_ACCEPTED: 'Debes aceptar los términos y la política de privacidad vigentes.',
  ORDER_NOT_PAYABLE: 'Este pedido ya no se puede pagar. Revisa su estado.',
  LOT_EXPIRY_MISMATCH: 'El lote ya existe con otra fecha de vencimiento.',
  ALREADY_VERIFIED: 'Tu cuenta profesional ya está verificada.',
  IMMUTABLE_RECORD: 'Este registro no se puede modificar.',
  INVALID_INPUT: 'Revisa los datos ingresados.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  RATE_LIMITED: 'Demasiadas solicitudes. Espera un momento e intenta nuevamente.',
  SESSION_EXPIRED: 'Tu sesión expiró. Inicia sesión nuevamente.',
  NETWORK: 'Sin conexión. Revisa tu conexión a internet e intenta nuevamente.',
  UNKNOWN: 'Ocurrió un error inesperado. Intenta nuevamente.',
} as const;

export type BusinessErrorCode = keyof typeof BUSINESS_ERROR_MESSAGES;

/** Errores de Supabase Auth (propiedad `code` de AuthError). */
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Debes confirmar tu correo antes de iniciar sesión.',
  user_already_exists: 'Ya existe una cuenta con este correo.',
  email_exists: 'Ya existe una cuenta con este correo.',
  weak_password: 'La contraseña no cumple los requisitos de seguridad.',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  over_email_send_rate_limit: 'Enviamos demasiados correos. Espera unos minutos e intenta nuevamente.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e intenta nuevamente.',
  otp_expired: 'El enlace expiró. Solicita uno nuevo.',
  session_not_found: 'Tu sesión expiró. Inicia sesión nuevamente.',
  refresh_token_not_found: 'Tu sesión expiró. Inicia sesión nuevamente.',
  signup_disabled: 'El registro de cuentas está deshabilitado temporalmente.',
  mfa_verification_failed: 'El código de verificación es incorrecto.',
  mfa_challenge_expired: 'El código de verificación expiró. Intenta nuevamente.',
};

export interface AppError {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Normaliza cualquier error (PostgREST, Auth, red) a un AppError con mensaje en español. */
export function toAppError(err: unknown): AppError {
  if (err instanceof TypeError && /network|fetch/i.test(err.message)) {
    return { code: 'NETWORK', message: BUSINESS_ERROR_MESSAGES.NETWORK };
  }
  if (!isRecord(err)) {
    return { code: 'UNKNOWN', message: BUSINESS_ERROR_MESSAGES.UNKNOWN };
  }

  const message = str(err.message) ?? '';
  const code = str(err.code);
  const detail = str(err.details) ?? str(err.detail);
  const hint = str(err.hint);

  // Errores de negocio: la función SQL usa el código como mensaje.
  if (message in BUSINESS_ERROR_MESSAGES) {
    const key = message as BusinessErrorCode;
    return { code: key, message: BUSINESS_ERROR_MESSAGES[key], detail, hint };
  }

  // Supabase Auth.
  const isAuthError = err.__isAuthError === true || /^Auth/.test(str(err.name) ?? '');
  if (isAuthError) {
    if (code && AUTH_ERROR_MESSAGES[code]) {
      return { code, message: AUTH_ERROR_MESSAGES[code]! };
    }
    if (/invalid login credentials/i.test(message)) {
      return { code: 'invalid_credentials', message: AUTH_ERROR_MESSAGES.invalid_credentials! };
    }
    if (/email not confirmed/i.test(message)) {
      return { code: 'email_not_confirmed', message: AUTH_ERROR_MESSAGES.email_not_confirmed! };
    }
    if (str(err.name) === 'AuthRetryableFetchError') {
      return { code: 'NETWORK', message: BUSINESS_ERROR_MESSAGES.NETWORK };
    }
    return { code: code ?? 'AUTH_ERROR', message: BUSINESS_ERROR_MESSAGES.UNKNOWN };
  }

  // PostgreSQL / PostgREST.
  if (code === '42501') {
    return { code: 'PERMISSION_DENIED', message: BUSINESS_ERROR_MESSAGES.PERMISSION_DENIED };
  }
  if (code === 'PGRST301' || code === 'PGRST303') {
    return { code: 'SESSION_EXPIRED', message: BUSINESS_ERROR_MESSAGES.SESSION_EXPIRED };
  }
  if (code === 'PGRST116') {
    return { code: 'NOT_FOUND', message: BUSINESS_ERROR_MESSAGES.NOT_FOUND };
  }
  // Fallas de red y solicitudes abortadas por tiempo máximo (PostgREST las informa como «AbortError: …»).
  if (/network request failed|failed to fetch|networkerror|^(AbortError|TimeoutError)\b/i.test(message)) {
    return { code: 'NETWORK', message: BUSINESS_ERROR_MESSAGES.NETWORK };
  }
  return { code: 'UNKNOWN', message: BUSINESS_ERROR_MESSAGES.UNKNOWN, detail };
}
