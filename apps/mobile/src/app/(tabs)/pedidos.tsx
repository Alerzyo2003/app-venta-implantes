import { formatCLP, formatDateTime, ORDER_STATUS_LABELS } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Badge, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useOrders } from '@/features/orders/api';
import { ORDER_TONE } from '@/features/orders/labels';

export default function OrdersScreen() {
  return (
    <RequireAuth icon="orders" title="Tus pedidos" message="Inicia sesión para ver el historial de tus compras en cualquier dispositivo.">
      <OrdersList />
    </RequireAuth>
  );
}

function OrdersList() {
  const orders = useOrders();
  if (orders.isPending) return <LoadingState />;
  if (orders.isError) {
    return (
      <Screen>
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen refreshing={orders.isRefetching} onRefresh={() => orders.refetch()}>
      {orders.data.length === 0 ? (
        <EmptyState
          icon="orders"
          title="Aún no tienes pedidos"
          message="Tus compras aparecerán aquí con su estado, pago y seguimiento."
          actionLabel="Explorar el catálogo"
          onAction={() => router.push('/')}
        />
      ) : (
        orders.data.map((o) => (
          <Card
            key={o.id}
            accessibilityLabel={`Pedido ${o.order_number}, ${ORDER_STATUS_LABELS[o.status]}, total ${formatCLP(o.total)}`}
            onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="title">{o.order_number}</AppText>
                <Badge label={ORDER_STATUS_LABELS[o.status]} tone={ORDER_TONE[o.status]} />
              </View>
              <AppText color="textMuted">{formatDateTime(o.placed_at, { withTime: true })}</AppText>
              <AppText variant="label">{formatCLP(o.total)}</AppText>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
