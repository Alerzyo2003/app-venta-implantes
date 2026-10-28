/**
 * Dinero en CLP. Los montos son enteros (el peso chileno no usa decimales).
 * Toda la aritmética usa enteros para evitar errores de punto flotante.
 */

export const CURRENCY = 'CLP' as const;

/** Verifica que el valor sea un entero seguro y no negativo. */
export function assertAmount(value: number, label = 'monto'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} debe ser un entero no negativo (recibido: ${value})`);
  }
}

/**
 * División entera con redondeo "half-up" para enteros no negativos: round(a / b).
 * Equivale a `round(a::numeric / b)` de PostgreSQL para valores positivos.
 */
export function divRoundHalfUp(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b <= 0) {
    throw new RangeError(`divRoundHalfUp requiere enteros (a >= 0, b > 0): ${a} / ${b}`);
  }
  return Math.floor((2 * a + b) / (2 * b));
}

/** Convierte una tasa decimal (0.19) a puntos base (1900) sin errores de flotante. */
export function rateToBasisPoints(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new RangeError(`Tasa inválida: ${rate}`);
  }
  return Math.round(rate * 10_000);
}

const clpFormatter = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Formatea un monto CLP: 12990 → "$12.990". */
export function formatCLP(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${clpFormatter.format(Math.abs(Math.round(amount)))}`;
}
