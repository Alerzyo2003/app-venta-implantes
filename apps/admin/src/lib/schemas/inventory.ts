import { z } from 'zod';

import { integer, optionalText, optionalUuid, requiredUuid } from './common';

export const LOT_STATUSES = ['available', 'quarantine', 'recalled', 'expired'] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  available: 'Disponible',
  quarantine: 'En cuarentena',
  recalled: 'Retirado del mercado',
  expired: 'Vencido',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receipt: 'Ingreso',
  adjustment: 'Ajuste',
  sale_dispatch: 'Despacho de venta',
  return_restock: 'Devolución a stock',
  transfer_out: 'Transferencia (salida)',
  transfer_in: 'Transferencia (entrada)',
  write_off: 'Baja',
};

export const STOCK_STATUS_LABELS = {
  in_stock: 'Disponible',
  low_stock: 'Últimas unidades',
  out_of_stock: 'Agotado',
} as const;
export type StockStatus = keyof typeof STOCK_STATUS_LABELS;

/** Fecha de calendario de un <input type="date"> (AAAA-MM-DD) que exista de verdad. */
const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      const date = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
      if (!m || !date || date.toISOString().slice(0, 10) !== v) {
        ctx.addIssue({ code: 'custom', message: `${label}: fecha no válida.` });
        return z.NEVER;
      }
      return v;
    });

const requestId = z.uuid('Recarga la página e intenta nuevamente.');

export const receiveSchema = z.object({
  warehouseId: requiredUuid('Selecciona la bodega.'),
  quantity: integer('Cantidad', { min: 1, max: 1_000_000 }),
  lotNumber: optionalText(40, 'Número de lote'),
  expiryDate: optionalDate('Vencimiento'),
  reason: optionalText(500, 'Nota'),
  requestId,
});

export const adjustSchema = z.object({
  warehouseId: requiredUuid('Selecciona la bodega.'),
  direction: z.enum(['in', 'out'], 'Indica si el ajuste suma o resta unidades.'),
  quantity: integer('Cantidad', { min: 1, max: 1_000_000 }),
  lotId: optionalUuid,
  reason: z.string().trim().min(3, 'Indica el motivo del ajuste.').max(500, 'Motivo: máximo 500 caracteres.'),
  requestId,
});

export const lotStatusSchema = z.object({
  status: z.enum(LOT_STATUSES, 'Selecciona el nuevo estado.'),
  reason: z.string().trim().min(3, 'Indica el motivo del cambio.').max(500, 'Motivo: máximo 500 caracteres.'),
});

export const WAREHOUSE_CODE = /^[A-Z0-9_-]{2,20}$/;

export const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(WAREHOUSE_CODE, 'De 2 a 20 caracteres: mayúsculas, números, guion o guion bajo.'),
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
  addressLine: optionalText(200, 'Dirección'),
  comunaCode: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.string().regex(/^\d{5}$/, 'Selecciona una comuna válida.').nullable()),
  isActive: z.boolean(),
  isSellable: z.boolean(),
  isPickupPoint: z.boolean(),
  priority: integer('Prioridad', { min: 0, max: 1000 }),
});

export function readWarehouseForm(data: FormData) {
  const text = (name: string) => {
    const v = data.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    code: text('code'),
    name: text('name'),
    addressLine: text('addressLine'),
    comunaCode: text('comunaCode'),
    isActive: data.get('isActive') === 'on',
    isSellable: data.get('isSellable') === 'on',
    isPickupPoint: data.get('isPickupPoint') === 'on',
    priority: text('priority') || '100',
  };
}
