import {
  formatCalendarDate,
  formatCLP,
  formatDateTime,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  toAppError,
  whatsappMessages,
} from '@repo/domain';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { AppText, Badge, Button, Card, Divider, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useCancelOrder, useOrder, type OrderDetail } from '@/features/orders/api';
import { confirmAction } from '@/lib/confirm';
import { ORDER_TONE } from '@/features/orders/labels';
import { useAppTheme } from '@/theme/theme';

export default function OrderScreen() {
  return (
    <RequireAuth icon="orders" title="Detalle del pedido" message="Inicia sesión para ver tus pedidos.">
      <OrderContent />
    </RequireAuth>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <AppText color={strong ? 'text' : 'textMuted'} weight={strong ? '700' : '400'}>
        {label}
      </AppText>
      <AppText weight={strong ? '700' : '400'} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}

function deliveryText(o: OrderDetail): string {
  if (o.delivered_at) return `Entregado el ${formatDateTime(o.delivered_at)}`;
  if (o.estimated_delivery_min && o.estimated_delivery_max) {
    const a = formatCalendarDate(o.estimated_delivery_min);
    const b = formatCalendarDate(o.estimated_delivery_max);
    return a === b ? `Estimado: ${a}` : `Estimado: entre ${a} y ${b}`;
  }
  return 'Plazo por confirmar';
}

function OrderContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spacing } = useAppTheme();
  const order = useOrder(id);
  const cancel = useCancelOrder();

  if (order.isPending) return <LoadingState />;
  if (order.isError) {
    return (
      <Screen>
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </Screen>
    );
  }
  if (!order.data) {
    return (
      <Screen>
        <EmptyState icon="help" title="Pedido no encontrado" message="El pedido no existe o no pertenece a tu cuenta." />
      </Screen>
    );
  }

  const o = order.data;
  const isGross = o.price_mode === 'gross';
  const canCancel = o.status === 'pending_payment' && !o.payments.some((p) => p.status === 'approved' || p.status === 'authorized');

  return (
    <Screen refreshing={order.isRefetching} onRefresh={() => order.refetch()}>
      <Stack.Screen options={{ title: o.order_number }} />
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="title">{o.order_number}</AppText>
            <Badge label={ORDER_STATUS_LABELS[o.status]} tone={ORDER_TONE[o.status]} />
          </View>
          <AppText color="textMuted">Realizado el {formatDateTime(o.placed_at, { withTime: true })}</AppText>
          {o.status === 'pending_payment' && o.reservation_expires_at ? (
            <AppText variant="caption" color="warning">
              Stock reservado hasta las {formatDateTime(o.reservation_expires_at, { withTime: true }).split(' ')[1]}. Si no se
              confirma el pago, el pedido se cancelará automáticamente.
            </AppText>
          ) : null}
          {o.status === 'cancelled' && o.cancel_reason ? <AppText variant="caption">Motivo: {o.cancel_reason}</AppText> : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">Productos</AppText>
          {o.items.map((item, i) => (
            <View key={item.id} style={{ gap: 2 }}>
              {i > 0 ? <Divider /> : null}
              <AppText weight="600">{item.product_name}</AppText>
              <AppText variant="caption" color="textMuted">
                {[item.variant_label, `SKU ${item.sku}`].filter(Boolean).join(' · ')}
              </AppText>
              <Row
                label={`${item.quantity} × ${formatCLP(isGross ? item.unit_price_gross : item.unit_price_net)}${isGross ? '' : ' + IVA'}`}
                value={formatCLP(item.line_total)}
              />
            </View>
          ))}
          <Divider />
          {isGross ? (
            <>
              <Row label="Despacho" value={formatCLP(o.shipping_gross)} />
              <Row label="Total (IVA incluido)" value={formatCLP(o.total)} strong />
              <AppText variant="caption" color="textMuted">
                Incluye IVA por {formatCLP(o.tax_amount)}.
              </AppText>
            </>
          ) : (
            <>
              <Row label="Subtotal neto" value={formatCLP(o.subtotal_net)} />
              <Row label="Despacho neto" value={formatCLP(o.shipping_net)} />
              <Row label="IVA" value={formatCLP(o.tax_amount)} />
              <Row label="Total" value={formatCLP(o.total)} strong />
            </>
          )}
          <AppText variant="caption" color="textMuted">
            Precios históricos del momento de la compra · Documento: {o.document_type === 'factura' ? 'factura' : 'boleta'}
            {o.billing_snapshot ? ` a ${o.billing_snapshot.business_name}` : ''}
          </AppText>
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">Entrega</AppText>
          <Row label="Modalidad" value={o.shipping_snapshot.method_name} />
          {o.shipping_address_snapshot ? (
            <Row
              label="Dirección"
              value={`${o.shipping_address_snapshot.street} ${o.shipping_address_snapshot.street_number}${
                o.shipping_address_snapshot.unit ? `, ${o.shipping_address_snapshot.unit}` : ''
              }, ${o.shipping_address_snapshot.comuna}`}
            />
          ) : o.shipping_snapshot.pickup_point ? (
            <Row label="Retiro en" value={o.shipping_snapshot.pickup_point.name} />
          ) : null}
          <Row label="Plazo" value={deliveryText(o)} />
          {o.shipments.map((s) => (
            <View key={s.id} style={{ gap: 4, marginTop: spacing.sm }}>
              <Divider />
              <Row label="Transportista" value={s.carrier} />
              <Row label="Estado del envío" value={SHIPMENT_STATUS_LABELS[s.status]} />
              {s.tracking_number ? <Row label="N° de seguimiento" value={s.tracking_number} /> : null}
              {s.tracking_url ? (
                <Button title="Ver seguimiento del transportista" variant="outline" icon="external" onPress={() => Linking.openURL(s.tracking_url!)} />
              ) : null}
              {[...s.events]
                .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
                .map((e) => (
                  <AppText key={e.id} variant="caption" color="textMuted">
                    {formatDateTime(e.occurred_at, { withTime: true })} · {SHIPMENT_STATUS_LABELS[e.status as keyof typeof SHIPMENT_STATUS_LABELS] ?? e.status}
                    {e.description ? ` · ${e.description}` : ''}
                  </AppText>
                ))}
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">Pago</AppText>
          {o.payments.length === 0 ? (
            <AppText color="textMuted">Sin pagos registrados.</AppText>
          ) : (
            o.payments.map((p) => (
              <Row
                key={p.id}
                label={`${formatDateTime(p.created_at)}${p.card_last4 ? ` · tarjeta ···· ${p.card_last4}` : ''}`}
                value={`${PAYMENT_STATUS_LABELS[p.status]} · ${formatCLP(p.amount)}`}
              />
            ))
          )}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">Historial</AppText>
          {o.history.map((h) => (
            <AppText key={h.id} variant="caption">
              {formatDateTime(h.created_at, { withTime: true })} · {ORDER_STATUS_LABELS[h.to_status]}
              {h.reason ? ` · ${h.reason}` : ''}
            </AppText>
          ))}
        </View>
      </Card>

      <WhatsAppButton message={whatsappMessages.order(o.order_number)} />
      {canCancel ? (
        <Button
          title="Cancelar pedido"
          variant="ghost"
          loading={cancel.isPending}
          onPress={async () => {
            const ok = await confirmAction({
              title: 'Cancelar pedido',
              message: 'Se liberará el stock reservado. Esta acción no se puede deshacer.',
              confirmLabel: 'Cancelar pedido',
              destructive: true,
            });
            if (ok) cancel.mutate(o.id);
          }}
        />
      ) : null}
      {cancel.isError ? <AppText color="danger">{toAppError(cancel.error).message}</AppText> : null}
    </Screen>
  );
}
