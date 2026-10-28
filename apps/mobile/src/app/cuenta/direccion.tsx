import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema, formatChileanPhone, toAppError, type AddressData, type AddressInput } from '@repo/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ComunaPicker } from '@/components/ComunaPicker';
import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Button, Card, Checkbox, LoadingState, Screen, TextField } from '@/components/ui';
import { useAddresses, useArchiveAddress, useSaveAddress, type Address } from '@/features/account/api';
import { confirmAction } from '@/lib/confirm';

export default function AddressScreen() {
  return (
    <RequireAuth title="Dirección" message="Inicia sesión para administrar tus direcciones.">
      <AddressLoader />
    </RequireAuth>
  );
}

function AddressLoader() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const addresses = useAddresses();
  if (id && addresses.isPending) return <LoadingState />;
  const existing = id ? addresses.data?.find((a) => a.id === id) : undefined;
  return <AddressForm key={existing?.id ?? 'nueva'} existing={existing} />;
}

function AddressForm({ existing }: { existing?: Address }) {
  const save = useSaveAddress();
  const archive = useArchiveAddress();
  const { control, handleSubmit, formState } = useForm<AddressInput, unknown, AddressData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: existing?.label ?? '',
      recipientName: existing?.recipient_name ?? '',
      phone: existing?.phone ? formatChileanPhone(existing.phone) : '',
      street: existing?.street ?? '',
      streetNumber: existing?.street_number ?? '',
      unit: existing?.unit ?? '',
      comunaCode: existing?.comuna_code ?? '',
      reference: existing?.reference ?? '',
      isDefault: existing?.is_default ?? false,
    },
  });

  const text = (
    name: 'label' | 'recipientName' | 'phone' | 'street' | 'streetNumber' | 'unit' | 'reference',
    label: string,
    extra: object = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          label={label}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={formState.errors[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <Screen
      footer={
        <Button
          title={existing ? 'Guardar cambios' : 'Agregar dirección'}
          loading={save.isPending}
          onPress={() => void handleSubmit((input) => save.mutate({ id: existing?.id, input }, { onSuccess: () => router.back() }))()}
        />
      }>
      <Card>
        <View style={{ gap: 16 }}>
          {text('label', 'Nombre de la dirección (opcional)', { placeholder: 'Clínica, consulta, casa…' })}
          {text('recipientName', 'Quién recibe')}
          {text('phone', 'Teléfono de contacto', { keyboardType: 'phone-pad' })}
          {text('street', 'Calle')}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>{text('streetNumber', 'Número')}</View>
            <View style={{ flex: 1 }}>{text('unit', 'Depto. / oficina')}</View>
          </View>
          <Controller
            control={control}
            name="comunaCode"
            render={({ field }) => <ComunaPicker value={field.value} onChange={field.onChange} error={formState.errors.comunaCode?.message} />}
          />
          {text('reference', 'Referencia (opcional)', { multiline: true })}
          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => <Checkbox checked={field.value} onChange={field.onChange} label="Usar como dirección predeterminada" />}
          />
          {save.isError ? <AppText color="danger">{toAppError(save.error).message}</AppText> : null}
        </View>
      </Card>
      {existing ? (
        <Button
          title="Eliminar dirección"
          variant="ghost"
          icon="trash"
          loading={archive.isPending}
          onPress={async () => {
            const ok = await confirmAction({
              title: 'Eliminar dirección',
              message: 'Los pedidos anteriores conservan la dirección con la que se despacharon.',
              confirmLabel: 'Eliminar',
              destructive: true,
            });
            if (ok) archive.mutate(existing.id, { onSuccess: () => router.back() });
          }}
        />
      ) : null}
    </Screen>
  );
}
