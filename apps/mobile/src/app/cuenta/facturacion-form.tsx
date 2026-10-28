import { zodResolver } from '@hookform/resolvers/zod';
import { billingProfileSchema, formatRut, toAppError, type BillingProfileData, type BillingProfileInput } from '@repo/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ComunaPicker } from '@/components/ComunaPicker';
import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Button, Card, LoadingState, Screen, TextField } from '@/components/ui';
import { useBillingProfiles, useDeleteBillingProfile, useSaveBillingProfile, type BillingProfile } from '@/features/account/api';
import { confirmAction } from '@/lib/confirm';

export default function BillingFormScreen() {
  return (
    <RequireAuth title="Datos de facturación" message="Inicia sesión para continuar.">
      <Loader />
    </RequireAuth>
  );
}

function Loader() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profiles = useBillingProfiles();
  if (id && profiles.isPending) return <LoadingState />;
  const existing = id ? profiles.data?.find((b) => b.id === id) : undefined;
  return <BillingForm key={existing?.id ?? 'nuevo'} existing={existing} />;
}

function BillingForm({ existing }: { existing?: BillingProfile }) {
  const save = useSaveBillingProfile();
  const remove = useDeleteBillingProfile();
  const { control, handleSubmit, formState } = useForm<BillingProfileInput, unknown, BillingProfileData>({
    resolver: zodResolver(billingProfileSchema),
    defaultValues: {
      rut: existing ? formatRut(existing.rut) : '',
      businessName: existing?.business_name ?? '',
      giro: existing?.giro ?? '',
      addressLine: existing?.address_line ?? '',
      comunaCode: existing?.comuna_code ?? '',
      dteEmail: existing?.dte_email ?? '',
    },
  });

  const text = (name: 'rut' | 'businessName' | 'giro' | 'addressLine' | 'dteEmail', label: string, extra: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField label={label} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <Screen
      footer={
        <Button
          title="Guardar"
          loading={save.isPending}
          onPress={() => void handleSubmit((input) => save.mutate({ id: existing?.id, input }, { onSuccess: () => router.back() }))()}
        />
      }>
      <Card>
        <View style={{ gap: 16 }}>
          {text('rut', 'RUT de la empresa', { autoCapitalize: 'characters', placeholder: '76.123.456-7' })}
          {text('businessName', 'Razón social')}
          {text('giro', 'Giro')}
          {text('addressLine', 'Dirección tributaria')}
          <Controller
            control={control}
            name="comunaCode"
            render={({ field }) => <ComunaPicker value={field.value} onChange={field.onChange} error={formState.errors.comunaCode?.message} />}
          />
          {text('dteEmail', 'Correo para documentos tributarios', { keyboardType: 'email-address', autoCapitalize: 'none' })}
          {save.isError ? <AppText color="danger">{toAppError(save.error).message}</AppText> : null}
        </View>
      </Card>
      {existing ? (
        <Button
          title="Eliminar"
          variant="ghost"
          icon="trash"
          loading={remove.isPending}
          onPress={async () => {
            const ok = await confirmAction({
              title: 'Eliminar datos de facturación',
              message: 'Los pedidos anteriores conservan los datos con que se emitieron.',
              confirmLabel: 'Eliminar',
              destructive: true,
            });
            if (ok) remove.mutate(existing.id, { onSuccess: () => router.back() });
          }}
        />
      ) : null}
    </Screen>
  );
}
