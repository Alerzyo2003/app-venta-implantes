/**
 * Contacto con asesores por WhatsApp mediante enlace "click-to-chat" (WSP-01..03).
 * Abrir el enlace NO equivale a enviar un mensaje: la app nunca afirma que se envió.
 * Los mensajes incluyen solo SKU, nombre o número de pedido; nunca datos personales.
 */

export interface BusinessHours {
  /** Días ISO: 1 = lunes … 7 = domingo. */
  days: number[];
  /** Hora de apertura y cierre "HH:MM" en la zona horaria indicada. */
  open: string;
  close: string;
}

export function buildWhatsAppUrl(phoneE164: string, message?: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(digits)) throw new RangeError(`Número de WhatsApp inválido: ${phoneE164}`);
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const whatsappMessages = {
  product: (p: { productName: string; sku?: string }) =>
    p.sku
      ? `Hola, quisiera consultar por el producto ${p.productName} (SKU ${p.sku}).`
      : `Hola, quisiera consultar por el producto ${p.productName}.`,
  cart: (skus: string[]) =>
    `Hola, tengo una consulta sobre estos productos: ${skus.slice(0, 20).join(', ')}.`,
  order: (orderNumber: string) => `Hola, quisiera consultar por mi pedido ${orderNumber}.`,
  quote: (quoteNumber: string) => `Hola, quisiera consultar por la cotización ${quoteNumber}.`,
  support: () => 'Hola, necesito ayuda con una consulta.',
};

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function toMinutes(hhmm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new RangeError(`Hora inválida: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isWithinBusinessHours(
  hours: BusinessHours[],
  now: Date,
  timeZone = 'America/Santiago',
): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = WEEKDAYS[get('weekday')];
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  if (!day) return false;
  return hours.some(
    (h) => h.days.includes(day) && minutes >= toMinutes(h.open) && minutes < toMinutes(h.close),
  );
}
