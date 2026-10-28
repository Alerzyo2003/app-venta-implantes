'use client';

import { useActionState, useState } from 'react';

import { SelectInput, TextInput, type Option } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { formKey, IDLE, type FormState } from '@/lib/forms';
import { LOT_STATUS_LABELS, LOT_STATUSES } from '@/lib/schemas/inventory';

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

/**
 * Ingreso de mercadería. requestId identifica el envío: si la respuesta se pierde y se reintenta,
 * la base devuelve el movimiento ya registrado en vez de duplicarlo. Cambia tras cada ingreso.
 */
export function ReceiveForm({
  action,
  warehouses,
  tracksLots,
  tracksExpiry,
  requestId,
}: {
  action: Action;
  warehouses: Option[];
  tracksLots: boolean;
  tracksExpiry: boolean;
  requestId: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const err = (name: string) => state.fieldErrors?.[name];
  const keep = (name: string) => (state.status === 'error' ? state.values?.[name] : undefined);
  return (
    <form key={formKey(state)} action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Bodega" name="warehouseId" id="ingreso-warehouseId" required placeholder="Selecciona…" options={warehouses} defaultValue={keep('warehouseId')} error={err('warehouseId')} />
        <TextInput label="Cantidad" name="quantity" id="ingreso-quantity" required inputMode="numeric" defaultValue={keep('quantity')} error={err('quantity')} />
        {tracksLots ? (
          <TextInput label="Número de lote" name="lotNumber" id="ingreso-lotNumber" required autoComplete="off" defaultValue={keep('lotNumber')} error={err('lotNumber')} />
        ) : null}
        {tracksExpiry ? (
          <TextInput label="Vencimiento" name="expiryDate" id="ingreso-expiryDate" type="date" required defaultValue={keep('expiryDate')} error={err('expiryDate')} />
        ) : null}
      </div>
      <TextInput label="Nota (opcional)" name="reason" id="ingreso-reason" placeholder="Ej.: factura o guía del proveedor" defaultValue={keep('reason')} error={err('reason')} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Registrando…">Registrar ingreso</SubmitButton>
      </div>
    </form>
  );
}

const ADJUST_REASONS = ['Conteo físico', 'Producto dañado', 'Producto vencido', 'Error de registro', 'Muestra o uso interno'];

export function AdjustForm({
  action,
  warehouses,
  lots,
  requestId,
}: {
  action: Action;
  warehouses: Option[];
  /** Lotes de la variante (vacío si no controla lotes). */
  lots: Option[] | null;
  requestId: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const err = (name: string) => state.fieldErrors?.[name];
  const keep = (name: string) => (state.status === 'error' ? state.values?.[name] : undefined);
  return (
    <form key={formKey(state)} action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Bodega" name="warehouseId" id="ajuste-warehouseId" required placeholder="Selecciona…" options={warehouses} defaultValue={keep('warehouseId')} error={err('warehouseId')} />
        {lots ? (
          <SelectInput label="Lote" name="lotId" id="ajuste-lotId" required placeholder="Selecciona…" options={lots} defaultValue={keep('lotId')} error={err('lotId')} />
        ) : null}
        <SelectInput
          label="Tipo de ajuste"
          name="direction"
          id="ajuste-direction"
          required
          options={[
            { value: 'out', label: 'Restar unidades' },
            { value: 'in', label: 'Sumar unidades' },
          ]}
          defaultValue={keep('direction') ?? 'out'}
          error={err('direction')}
        />
        <TextInput label="Cantidad" name="quantity" id="ajuste-quantity" required inputMode="numeric" defaultValue={keep('quantity')} error={err('quantity')} />
      </div>
      <TextInput
        label="Motivo"
        name="reason"
        id="ajuste-reason"
        required
        list="motivos-ajuste"
        defaultValue={keep('reason')}
        error={err('reason')}
        hint="Queda registrado en el libro de movimientos con tu nombre."
      />
      <datalist id="motivos-ajuste">
        {ADJUST_REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Registrando…">
          Registrar ajuste
        </SubmitButton>
      </div>
    </form>
  );
}

export function LotStatusForm({ action, current, lotId, lotNumber }: { action: Action; current: string; lotId: string; lotNumber: string }) {
  const [state, formAction] = useActionState(action, IDLE);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Cambiar estado
      </button>
    );
  }
  const options = LOT_STATUSES.filter((s) => s !== current).map((s) => ({ value: s, label: LOT_STATUS_LABELS[s] }));
  return (
    <form key={formKey(state)} action={formAction} className="flex min-w-64 flex-col gap-2" noValidate>
      <SelectInput label={`Nuevo estado del lote ${lotNumber}`} name="status" id={`estado-${lotId}`} required options={options} error={state.fieldErrors?.status} />
      <TextInput label="Motivo" name="reason" id={`motivo-${lotId}`} required error={state.fieldErrors?.reason} />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Guardando…">Guardar</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-fg-muted hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
