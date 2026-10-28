'use client';

import { useActionState } from 'react';

import { Checkbox, controlClasses, Field, TextInput } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/feedback';
import { SubmitButton } from '@/components/ui/submit-button';
import { formKey, IDLE, type FormState } from '@/lib/forms';

export interface WarehouseDefaults {
  code: string;
  name: string;
  address_line: string | null;
  comuna_code: string | null;
  is_active: boolean;
  is_sellable: boolean;
  is_pickup_point: boolean;
  priority: number;
}

export interface RegionGroup {
  code: string;
  name: string;
  comunas: { code: string; name: string }[];
}

export function WarehouseForm({
  action,
  regions,
  warehouse,
  submitLabel,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  regions: RegionGroup[];
  warehouse?: WarehouseDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const v = (name: string, fallback: string | null | undefined) => state.values?.[name] ?? fallback ?? '';
  const checked = (name: string, fallback: boolean) => (state.values ? state.values[name] === 'on' : fallback);
  const err = (name: string) => state.fieldErrors?.[name];
  return (
    <form key={formKey(state)} action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Código"
          name="code"
          required
          autoComplete="off"
          defaultValue={v('code', warehouse?.code)}
          error={err('code')}
          hint="Ej.: STGO-CENTRAL. Mayúsculas, números y guiones."
        />
        <TextInput label="Nombre" name="name" required defaultValue={v('name', warehouse?.name)} error={err('name')} />
        <TextInput label="Dirección" name="addressLine" defaultValue={v('addressLine', warehouse?.address_line)} error={err('addressLine')} />
        <Field label="Comuna" name="comunaCode" error={err('comunaCode')}>
          <select
            id="comunaCode"
            name="comunaCode"
            defaultValue={v('comunaCode', warehouse?.comuna_code)}
            aria-invalid={err('comunaCode') ? true : undefined}
            className={controlClasses}>
            <option value="">Sin comuna</option>
            {regions.map((r) => (
              <optgroup key={r.code} label={r.name}>
                {r.comunas.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <TextInput
          label="Prioridad de despacho"
          name="priority"
          inputMode="numeric"
          defaultValue={v('priority', String(warehouse?.priority ?? 100))}
          error={err('priority')}
          hint="Las bodegas con número menor se usan primero al reservar stock."
        />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Uso</legend>
        <Checkbox name="isActive" label="Activa" hint="Una bodega inactiva no recibe ingresos ni se usa para vender." defaultChecked={checked('isActive', warehouse?.is_active ?? true)} />
        <Checkbox name="isSellable" label="Su stock se puede vender" hint="Desmárcala para bodegas de cuarentena, devoluciones o tránsito." defaultChecked={checked('isSellable', warehouse?.is_sellable ?? true)} />
        <Checkbox name="isPickupPoint" label="Punto de retiro para clientes" hint="Se ofrece como opción de retiro en el checkout." defaultChecked={checked('isPickupPoint', warehouse?.is_pickup_point ?? false)} />
      </fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
