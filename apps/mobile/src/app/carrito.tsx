import { formatCLP, toAppError, whatsappMessages } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { AppText, Badge, Button, Card, Divider, EmptyState, ErrorState, Icon, IconButton, LoadingState, QuantityStepper, Screen } from '@/components/ui';
import { useCartSummary, useSetCartItem, type CartItem } from '@/features/cart/api';
import { useAppTheme } from '@/theme/theme';

export default function CartScreen() {
  return (
    <RequireAuth icon="cart" title="Tu carrito" message="Inicia sesión para usar el carrito: se guarda en tu cuenta y lo ves en todos tus dispositivos.">
      <CartContent />
    </RequireAuth>
  );
}

function CartLine({ item, onChange, busy }: { item: CartItem; onChange: (qty: number) => void; busy: boolean }) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText
            variant="bodyLarge"
            weight="600"
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/producto/[slug]', params: { slug: item.product_slug, variante: item.variant_id } })}>
            {item.product_name}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {[item.variant_label, `SKU ${item.sku}`].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <IconButton icon="trash" accessibilityLabel={`Quitar ${item.product_name}`} color={colors.danger} onPress={() => onChange(0)} disabled={busy} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <QuantityStepper value={item.quantity} onChange={onChange} disabled={busy} />
        {item.unit_price_net != null ? (
          <AppText variant="caption" color="textMuted">
            {formatCLP(item.unit_price_net)} c/u + IVA
          </AppText>
        ) : null}
      </View>
      {item.issue === 'OUT_OF_STOCK' ? (
        <Badge label={item.available_qty ? `Solo quedan ${item.available_qty} unidades` : 'Sin stock disponible'} tone="danger" />
      ) : item.issue ? (
        <AppText variant="caption" color="danger">
          {toAppError({ message: item.issue }).message}
        </AppText>
      ) : item.availability === 'low_stock' ? (
        <Badge label="Últimas unidades" tone="warning" />
      ) : null}
    </View>
  );
}

function CartContent() {
  const { spacing } = useAppTheme();
  const cart = useCartSummary({ documentType: 'boleta' });
  const setItem = useSetCartItem();

  if (cart.isPending) return <LoadingState />;
  if (cart.isError) {
    return (
      <Screen>
        <ErrorState error={cart.error} onRetry={() => cart.refetch()} />
      </Screen>
    );
  }
  const summary = cart.data;
  if (summary.items.length === 0) {
    return (
      <Screen>
        <EmptyState icon="cart" title="Tu carrito está vacío" actionLabel="Buscar productos" onAction={() => router.push('/buscar')} />
      </Screen>
    );
  }

  const totals = summary.totals;
  return (
    <Screen refreshing={cart.isRefetching} onRefresh={() => cart.refetch()}>
      <Card>
        {summary.items.map((item, i) => (
          <View key={item.cart_item_id}>
            {i > 0 ? <Divider /> : null}
            <CartLine
              item={item}
              busy={setItem.isPending}
              onChange={(quantity) => setItem.mutate({ variantId: item.variant_id, quantity })}
            />
          </View>
        ))}
      </Card>
      {setItem.isError ? <AppText color="danger">{toAppError(setItem.error).message}</AppText> : null}

      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">Resumen</AppText>
          {!summary.price_visible || !totals ? (
            <AppText color="textMuted">Los precios no están disponibles para tu cuenta.</AppText>
          ) : (
            <>
              <Row label="Productos (neto)" value={formatCLP(totals.subtotal_net)} />
              <Row label="IVA" value={formatCLP(totals.tax_amount)} />
              <Divider />
              <Row label="Total con IVA" value={formatCLP(totals.total)} strong />
              <AppText variant="caption" color="textMuted">
                Calculado por el servidor con los precios vigentes. El despacho se calcula según la dirección al confirmar la compra.
              </AppText>
            </>
          )}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Icon name="info" />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label">Pago en línea aún no habilitado</AppText>
            <AppText variant="caption" color="textMuted">
              El checkout se activará cuando se configure el medio de pago. Mientras tanto, un asesor puede ayudarte con tu compra.
            </AppText>
          </View>
        </View>
      </Card>
      <WhatsAppButton label="Solicitar cotización a un asesor" message={whatsappMessages.cart(summary.items.map((i) => i.sku))} />
      <Button title="Seguir comprando" variant="ghost" onPress={() => router.push('/buscar')} />
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText weight={strong ? '700' : '400'}>{label}</AppText>
      <AppText weight={strong ? '700' : '400'}>{value}</AppText>
    </View>
  );
}
