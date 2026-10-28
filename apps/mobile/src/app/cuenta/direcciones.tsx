import { router } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAddresses } from '@/features/account/api';

export default function AddressesScreen() {
  return (
    <RequireAuth title="Direcciones" message="Inicia sesión para administrar tus direcciones.">
      <AddressList />
    </RequireAuth>
  );
}

function AddressList() {
  const addresses = useAddresses();
  if (addresses.isPending) return <LoadingState />;
  if (addresses.isError) {
    return (
      <Screen>
        <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen
      refreshing={addresses.isRefetching}
      onRefresh={() => addresses.refetch()}
      footer={<Button title="Agregar dirección" icon="plus" onPress={() => router.push('/cuenta/direccion')} />}>
      {addresses.data.length === 0 ? (
        <EmptyState icon="location" title="Sin direcciones" message="Agrega una dirección para recibir tus pedidos." />
      ) : (
        addresses.data.map((a) => (
          <Card key={a.id} onPress={() => router.push({ pathname: '/cuenta/direccion', params: { id: a.id } })}>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="label">{a.label || a.recipient_name}</AppText>
                {a.is_default ? <Badge label="Predeterminada" tone="accent" /> : null}
              </View>
              <AppText>
                {a.street} {a.street_number}
                {a.unit ? `, ${a.unit}` : ''}
              </AppText>
              <AppText color="textMuted">{a.comuna?.name}</AppText>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
