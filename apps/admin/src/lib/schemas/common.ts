import { z } from 'zod';

/** Selector opcional: '' = sin valor. */
export const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.uuid('Selección no válida.').nullable());

export const requiredUuid = (message: string) => z.string().trim().pipe(z.uuid(message));

/** Texto opcional con largo máximo: '' se guarda como null. */
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v));

/**
 * Número decimal escrito por una persona en Chile: acepta coma o punto decimal («4,1» o «4.1»).
 * '' = sin valor.
 */
export const optionalDecimal = (label: string, { gt, lt }: { gt: number; lt: number }) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null;
      const normalized = v.replace(',', '.');
      if (!/^\d+(\.\d+)?$/.test(normalized)) {
        ctx.addIssue({ code: 'custom', message: `${label}: ingresa un número (por ejemplo 4,1).` });
        return z.NEVER;
      }
      const n = Number(normalized);
      if (!(n > gt && n < lt)) {
        ctx.addIssue({ code: 'custom', message: `${label}: debe ser mayor que ${gt} y menor que ${lt}.` });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    });

/** Monto en pesos chilenos (entero). Acepta separador de miles: «89.990» o «89990». '' = sin valor. */
export const optionalClp = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null;
      const digits = v.replace(/^\$\s*/, '').replace(/\./g, '');
      if (!/^\d{1,12}$/.test(digits)) {
        ctx.addIssue({ code: 'custom', message: `${label}: ingresa un monto en pesos, sin decimales.` });
        return z.NEVER;
      }
      const n = Number(digits);
      if (n <= 0) {
        ctx.addIssue({ code: 'custom', message: `${label}: debe ser mayor que cero.` });
        return z.NEVER;
      }
      return n;
    });

/** Entero con límites (cantidades de inventario, orden de presentación). */
export const integer = (label: string, { min, max }: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!/^[+-]?\d+$/.test(v)) {
        ctx.addIssue({ code: 'custom', message: `${label}: ingresa un número entero.` });
        return z.NEVER;
      }
      const n = Number(v);
      if (n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `${label}: debe estar entre ${min} y ${max}.` });
        return z.NEVER;
      }
      return n;
    });
