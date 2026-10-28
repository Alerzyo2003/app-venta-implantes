import type { ZodError } from 'zod';

/** Estado de un formulario manejado por una acción del servidor (useActionState). */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  /** Primer error por campo (nombre del campo → mensaje). */
  fieldErrors?: Record<string, string>;
  /**
   * Valores enviados, para volver a mostrarlos si hubo error (React reinicia el formulario
   * al terminar la acción). Nunca incluye contraseñas.
   */
  values?: Record<string, string>;
  /**
   * Cambia en cada respuesta. Se usa como `key` del formulario para volver a montarlo: así, tras un
   * error, todos los campos (incluidos los selectores) muestran lo enviado y, tras un éxito, quedan
   * limpios. (React reinicia los formularios al terminar una acción y los <select> no recuperan
   * su valor solo con defaultValue.)
   */
  key?: string;
}

export const IDLE: FormState = { status: 'idle' };

const responseKey = () => crypto.randomUUID();

/** `key` del formulario para un estado (el estado inicial usa una clave fija). */
export function formKey(state: { key?: string }): string {
  return state.key ?? 'inicial';
}

export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.');
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

export function invalid(error: ZodError, values?: Record<string, string>, message = 'Revisa los campos marcados.'): FormState {
  return { status: 'error', message, fieldErrors: fieldErrorsFrom(error), values, key: responseKey() };
}

export function failure(message: string, values?: Record<string, string>): FormState {
  return { status: 'error', message, values, key: responseKey() };
}

export function success(message: string): FormState {
  return { status: 'success', message, key: responseKey() };
}

/** Texto de un campo (sin espacios sobrantes); '' si no viene. */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Casilla de verificación HTML: viene «on» solo si está marcada. */
export function formBool(data: FormData, name: string): boolean {
  return data.get(name) === 'on';
}

const SENSITIVE = /pass|clave|secret|token|code/i;

/** Valores de texto enviados (sin campos sensibles ni internos de Next). */
export function formValues(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value !== 'string' || key.startsWith('$ACTION') || SENSITIVE.test(key)) continue;
    out[key] = value;
  }
  return out;
}
