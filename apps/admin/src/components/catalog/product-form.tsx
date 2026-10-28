'use client';

import { PRODUCT_KIND_CODES, PRODUCT_KINDS, productKindHasField, type ProductKind } from '@repo/domain';
import { useActionState, useState } from 'react';

import { Checkbox, SelectInput, TextArea, TextInput, type Option } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { formKey, IDLE, type FormState } from '@/lib/forms';
import { TAX_CLASS_LABELS } from '@/lib/schemas/product';

export interface ProductFormDefaults {
  name: string;
  slug: string;
  product_kind: ProductKind;
  category_id: string;
  brand_id: string | null;
  manufacturer_id: string | null;
  implant_system_id: string | null;
  short_description: string | null;
  description: string | null;
  usage_instructions: string | null;
  storage_conditions: string | null;
  tax_class: 'iva' | 'exempt';
  tracks_lots: boolean;
  tracks_expiry: boolean;
  requires_professional: boolean;
  is_featured: boolean;
}

export interface ProductFormOptions {
  categories: Option[];
  brands: Option[];
  manufacturers: Option[];
  systems: Option[];
}

const KIND_OPTIONS: Option[] = PRODUCT_KIND_CODES.map((k) => ({ value: k, label: PRODUCT_KINDS[k].label }));
const TAX_OPTIONS: Option[] = (Object.keys(TAX_CLASS_LABELS) as (keyof typeof TAX_CLASS_LABELS)[]).map((k) => ({
  value: k,
  label: TAX_CLASS_LABELS[k],
}));

const FIELD_NAMES: Record<string, string> = {
  implantSystem: 'sistema',
  platform: 'plataforma',
  connectionType: 'conexión',
  diameterMm: 'diámetro',
  lengthMm: 'largo',
};

export function ProductForm({
  action,
  options,
  product,
  submitLabel,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  options: ProductFormOptions;
  product?: ProductFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const v = (name: string, fallback: string | null | undefined) => state.values?.[name] ?? fallback ?? '';
  const err = (name: string) => state.fieldErrors?.[name];

  const initialKind = (state.values?.productKind as ProductKind | undefined) ?? product?.product_kind ?? 'implant';
  const [kind, setKind] = useState<ProductKind>(initialKind);
  const [tracksLots, setTracksLots] = useState(product?.tracks_lots ?? PRODUCT_KINDS[initialKind].tracksLotsDefault);
  const [tracksExpiry, setTracksExpiry] = useState(product?.tracks_expiry ?? PRODUCT_KINDS[initialKind].tracksExpiryDefault);

  const onKindChange = (next: ProductKind) => {
    setKind(next);
    // En productos nuevos, el tipo sugiere el control de lotes y vencimientos (se puede cambiar).
    if (!product) {
      setTracksLots(PRODUCT_KINDS[next].tracksLotsDefault);
      setTracksExpiry(PRODUCT_KINDS[next].tracksExpiryDefault);
    }
  };

  const fields = PRODUCT_KINDS[kind].technicalFields;
  const hasSystem = productKindHasField(kind, 'implantSystem');

  return (
    <form key={formKey(state)} action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Nombre" name="name" required defaultValue={v('name', product?.name)} error={err('name')} className="md:col-span-2" />
        <SelectInput
          label="Tipo de producto"
          name="productKind"
          required
          options={KIND_OPTIONS}
          value={kind}
          onChange={(e) => onKindChange(e.target.value as ProductKind)}
          error={err('productKind')}
          hint={
            fields.length > 0
              ? `Sus variantes registran: ${fields.map((f) => FIELD_NAMES[f]).join(', ')}.`
              : 'Sin campos técnicos de implantología.'
          }
        />
        <SelectInput
          label="Categoría"
          name="categoryId"
          required
          placeholder="Selecciona…"
          options={options.categories}
          defaultValue={v('categoryId', product?.category_id)}
          error={err('categoryId')}
        />
        <SelectInput
          label="Marca"
          name="brandId"
          placeholder="Sin marca"
          options={options.brands}
          defaultValue={v('brandId', product?.brand_id)}
          error={err('brandId')}
        />
        <SelectInput
          label="Fabricante"
          name="manufacturerId"
          placeholder="Sin fabricante"
          options={options.manufacturers}
          defaultValue={v('manufacturerId', product?.manufacturer_id)}
          error={err('manufacturerId')}
        />
        {hasSystem ? (
          <SelectInput
            label="Sistema de implantes"
            name="implantSystemId"
            placeholder="Sin sistema"
            options={options.systems}
            defaultValue={v('implantSystemId', product?.implant_system_id)}
            error={err('implantSystemId')}
            hint="Define qué plataformas se pueden asignar a las variantes."
          />
        ) : (
          <input type="hidden" name="implantSystemId" value="" />
        )}
        <TextInput
          label="Dirección web (slug)"
          name="slug"
          defaultValue={v('slug', product?.slug)}
          error={err('slug')}
          hint={product ? 'Cambiarla rompe los enlaces ya compartidos.' : 'Si la dejas vacía, se genera a partir del nombre.'}
        />
        <SelectInput
          label="Tributación"
          name="taxClass"
          required
          options={TAX_OPTIONS}
          defaultValue={v('taxClass', product?.tax_class ?? 'iva')}
          error={err('taxClass')}
        />
      </div>

      <TextArea
        label="Descripción breve"
        name="shortDescription"
        rows={2}
        maxLength={300}
        defaultValue={v('shortDescription', product?.short_description)}
        error={err('shortDescription')}
        hint="Se muestra en los listados (máximo 300 caracteres)."
      />
      <TextArea label="Descripción" name="description" rows={6} defaultValue={v('description', product?.description)} error={err('description')} />
      <TextArea
        label="Instrucciones de uso"
        name="usageInstructions"
        rows={4}
        defaultValue={v('usageInstructions', product?.usage_instructions)}
        error={err('usageInstructions')}
      />
      <TextArea
        label="Condiciones de almacenamiento"
        name="storageConditions"
        rows={2}
        defaultValue={v('storageConditions', product?.storage_conditions)}
        error={err('storageConditions')}
      />

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Control y venta</legend>
        <Checkbox
          name="tracksLots"
          label="Controla lotes"
          hint="Cada ingreso exige número de lote (trazabilidad hasta el cliente)."
          checked={tracksLots}
          onChange={(e) => {
            setTracksLots(e.target.checked);
            if (!e.target.checked) setTracksExpiry(false);
          }}
        />
        <Checkbox
          name="tracksExpiry"
          label="Controla vencimiento"
          hint="Cada lote exige fecha de vencimiento; se despacha primero lo que vence antes."
          checked={tracksExpiry}
          disabled={!tracksLots}
          onChange={(e) => setTracksExpiry(e.target.checked)}
        />
        {err('tracksExpiry') ? <p className="text-xs font-medium text-danger">{err('tracksExpiry')}</p> : null}
        <Checkbox
          name="requiresProfessional"
          label="Venta solo a profesionales verificados"
          defaultChecked={state.values ? state.values.requiresProfessional === 'on' : (product?.requires_professional ?? false)}
        />
        <Checkbox
          name="isFeatured"
          label="Destacado en el inicio de la tienda y la app"
          defaultChecked={state.values ? state.values.isFeatured === 'on' : (product?.is_featured ?? false)}
        />
      </fieldset>

      <FormMessage state={state} />
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
