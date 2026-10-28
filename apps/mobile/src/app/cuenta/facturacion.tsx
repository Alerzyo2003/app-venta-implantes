import { formatRut } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useBillingProfiles } from '@/features/account/api';

export default function BillingScreen() {
  return (
    <RequireAuth title="Datos de facturación" message="Inicia sesión para administrar tus datos de facturación.">
      <BillingList />
    </RequireAuth>
  );
}

function BillingList() {
  const profiles = useBillingProfiles();
  if (profiles.isPending) return <LoadingState />;
  if (profiles.isError) {
    return (
      <Screen>
        <ErrorState error={profiles.error} onRetry={() => profiles.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen footer={<Button title="Agregar datos de facturación" icon="plus" onPress={() => router.push('/cuenta/facturacion-form')} />}>
      <AppText color="textMuted">Se usan cuando eliges factura en una compra. La emisión de documentos tributarios se habilitará con la integración de facturación electrónica.</AppText>
      {profiles.data.length === 0 ? (
        <EmptyState icon="receipt" title="Sin datos de facturación" message="Agrega la razón social, RUT y giro de tu empresa o clínica." />
      ) : (
        profiles.data.map((b) => (
          <Card key={b.id} onPress={() => router.push({ pathname: '/cuenta/facturacion-form', params: { id: b.id } })}>
            <View style={{ gap: 4 }}>
              <AppText variant="label">{b.business_name}</AppText>
              <AppText>RUT {formatRut(b.rut)}</AppText>
              <AppText color="textMuted">{b.giro}</AppText>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
