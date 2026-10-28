'use client';

import { formatCLP, grossFromNet, PRODUCT_KINDS, productKindHasField, type ProductKind } from '@repo/domain';
import { useActionState, useState } from 'react';

import { SelectInput, TextInput, type Option } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { formKey, IDLE, type FormState } from '@/lib/forms';
import { VARIANT_STATUS_LABELS, VARIANT_STATUSES } from '@/lib/schemas/product';

export interface VariantFormDefaults {
  sku: string;
  manufacturer_ref: string | null;
  gtin: string | null;
  label: string | null;
  diameter_mm: number | null;
  length_mm: number | null;
  platform_id: string | null;
  connection_type_id: string | null;
  status: string;
  sort_order: number;
}

const STATUS_OPTIONS: Option[] = VARIANT_STATUSES.map((s) => ({ value: s, label: VARIANT_STATUS_LABELS[s] }));

const mm = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

function parseClp(input: string): number | null {
  const digits = input.trim().replace(/^\$\s*/, '').replace(/\./g, '');
  return /^\d{1,12}$/.test(digits) && Number(digits) > 0 ? Number(digits) : null;
}

export function VariantForm({
  action,
  kind,
  platforms,
  connectionTypes,
  variant,
  price,
  canEditPrice,
  ivaRateBp,
  taxClass,
  submitLabel,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  kind: ProductKind;
  platforms: Option[];
  connectionTypes: Option[];
  variant?: VariantFormDefaults;
  price: number | null;
  canEditPrice: boolean;
  ivaRateBp: number;
  taxClass: 'iva' | 'exempt';
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const v = (name: string, fallback: string | null | undefined) => state.values?.[name] ?? fallback ?? '';
  const err = (name: string) => state.fieldErrors?.[name];
  const [priceInput, setPriceInput] = useState(state.values?.priceNet ?? '');
  const net = parseClp(priceInput);
  const has = (field: Parameters<typeof productKindHasField>[1]) => productKindHasField(kind, field);

  return (
    <form key={formKey(state)} action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="SKU"
          name="sku"
          required
          autoComplete="off"
          defaultValue={v('sku', variant?.sku)}
          error={err('sku')}
          hint="Código interno único (sin espacios)."
        />
        <TextInput
          label="Código del fabricante"
          name="manufacturerRef"
          autoComplete="off"
          defaultValue={v('manufacturerRef', variant?.manufacturer_ref)}
          error={err('manufacturerRef')}
        />
        <TextInput
          label="Nombre de la variante"
          name="label"
          defaultValue={v('label', variant?.label)}
          error={err('label')}
          hint={`Ej.: «Ø 4,0 × 10 mm» o «Caja 50 unidades». Tipo: ${PRODUCT_KINDS[kind].label}.`}
        />
        <TextInput
          label="GTIN / código de barras"
          name="gtin"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={v('gtin', variant?.gtin)}
          error={err('gtin')}
          hint="EAN-13, GTIN-14 u otro GTIN del envase. Se valida el dígito verificador."
        />
        {has('diameterMm') ? (
          <TextInput
            label="Diámetro (mm)"
            name="diameterMm"
            inputMode="decimal"
            defaultValue={v('diameterMm', mm(variant?.diameter_mm ?? null))}
            error={err('diameterMm')}
          />
        ) : null}
        {has('lengthMm') ? (
          <TextInput
            label="Largo (mm)"
            name="lengthMm"
            inputMode="decimal"
            defaultValue={v('lengthMm', mm(variant?.length_mm ?? null))}
            error={err('lengthMm')}
          />
        ) : null}
        {has('platform') ? (
          <SelectInput
            label="Plataforma"
            name="platformId"
            placeholder="Sin plataforma"
            options={platforms}
            defaultValue={v('platformId', variant?.platform_id)}
            error={err('platformId')}
            hint={platforms.length === 0 ? 'Asigna un sistema de implantes al producto para elegir su plataforma.' : undefined}
          />
        ) : null}
        {has('connectionType') ? (
          <SelectInput
            label="Tipo de conexión"
            name="connectionTypeId"
            placeholder="Sin especificar"
            options={connectionTypes}
            defaultValue={v('connectionTypeId', variant?.connection_type_id)}
            error={err('connectionTypeId')}
          />
        ) : null}
        <SelectInput
          label="Estado"
          name="status"
          required
          options={STATUS_OPTIONS}
          defaultValue={v('status', variant?.status ?? 'active')}
          error={err('status')}
          hint="Inactiva: oculta a los clientes. Descontinuada: visible como referencia, sin reposición."
        />
        <TextInput
          label="Orden de presentación"
          name="sortOrder"
          inputMode="numeric"
          defaultValue={v('sortOrder', String(variant?.sort_order ?? 0))}
          error={err('sortOrder')}
        />
      </div>

      {canEditPrice ? (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-fg">Precio de lista base</legend>
          <p className="text-sm text-fg-muted">
            Precio actual: {price != null ? <strong className="text-fg">{formatCLP(price)} neto</strong> : 'sin precio (no se puede comprar)'}.
          </p>
          <TextInput
            label="Nuevo precio neto (CLP)"
            name="priceNet"
            inputMode="numeric"
            placeholder="Ej.: 89.990"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            error={err('priceNet')}
            hint={
              net !== null
                ? `Con ${taxClass === 'iva' ? 'IVA' : 'exención de IVA'}: ${formatCLP(grossFromNet(net, ivaRateBp, taxClass))} por unidad. El cambio queda en el historial de precios.`
                : 'Déjalo vacío para no cambiar el precio. Los precios se guardan sin IVA.'
            }
          />
        </fieldset>
      ) : null}

      <FormMessage state={state} />
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
