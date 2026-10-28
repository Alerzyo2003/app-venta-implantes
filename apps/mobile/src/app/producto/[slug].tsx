import {
  AVAILABILITY_LABELS,
  dimensionsLabel,
  PRODUCT_KINDS,
  productKindHasField,
  toAppError,
  whatsappMessages,
} from '@repo/domain';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CartButton } from '@/components/cart/CartButton';
import { CompatibilityList } from '@/components/catalog/CompatibilityList';
import { VariantSelector } from '@/components/catalog/VariantSelector';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListItem,
  LoadingState,
  PriceTag,
  QuantityStepper,
  Screen,
} from '@/components/ui';
import { useProfile } from '@/features/account/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAddToCart } from '@/features/cart/api';
import { useAvailability, useFavorites, useProduct, useToggleFavorite, useVariantPrices } from '@/features/catalog/api';
import { productMediaUrl } from '@/lib/supabase';
import { useAppTheme } from '@/theme/theme';

export default function ProductScreen() {
  const { slug, variante } = useLocalSearchParams<{ slug: string; variante?: string }>();
  const { colors, radius, spacing } = useAppTheme();
  const { user } = useAuth();
  const profile = useProfile();
  const product = useProduct(slug);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const addToCart = useAddToCart();

  const variants = useMemo(() => product.data?.variants ?? [], [product.data]);
  const variantIds = useMemo(() => variants.map((v) => v.id), [variants]);
  const prices = useVariantPrices(variantIds);
  const availability = useAvailability(variantIds);

  const [chosenId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Variante efectiva: la elegida por el usuario, la que llegó desde la búsqueda o la única disponible.
  const exists = (id: string | null | undefined) => !!id && variants.some((v) => v.id === id);
  const selectedId = exists(chosenId) ? chosenId : exists(variante) ? variante! : variants.length === 1 ? variants[0]!.id : null;

  if (product.isPending) return <LoadingState />;
  if (product.isError) {
    return (
      <Screen>
        <ErrorState error={product.error} onRetry={() => product.refetch()} />
      </Screen>
    );
  }
  if (!product.data) {
    return (
      <Screen>
        <EmptyState icon="help" title="Producto no disponible" message="Este producto no existe o ya no está publicado." />
      </Screen>
    );
  }

  const p = product.data;
  const kind = PRODUCT_KINDS[p.product_kind];
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const price = selected ? prices.data?.get(selected.id) : undefined;
  const stock = selected ? availability.data?.get(selected.id) : undefined;
  const isFavorite = !!favorites.data?.some((f) => f.product_id === p.id);
  const needsVerification = p.requires_professional && profile.data?.professional_status !== 'verified';
  const anyPriceVisible = [...(prices.data?.values() ?? [])].some((x) => x.price_visible);
  const canAdd = !!user && !!selected && selected.status === 'active' && stock?.status !== 'out_of_stock' && !needsVerification;
  // Hasta configurar Storage (incremento 1) solo se listan documentos con enlace externo verificable.
  const documents = p.documents
    .map((d) => d.document)
    .filter((d): d is NonNullable<typeof d> & { external_url: string } => !!d?.external_url);

  const specs: [string, string][] = [];
  if (p.brand) specs.push(['Marca', p.brand.name]);
  if (p.manufacturer) specs.push(['Fabricante', p.manufacturer.name]);
  if (p.system) specs.push(['Sistema', p.system.name]);
  if (selected) {
    specs.push(['SKU', selected.sku]);
    if (selected.manufacturer_ref) specs.push(['Código del fabricante', selected.manufacturer_ref]);
    const dims = dimensionsLabel({
      diameterMm: selected.diameter_mm != null ? Number(selected.diameter_mm) : null,
      lengthMm: selected.length_mm != null ? Number(selected.length_mm) : null,
    });
    if (dims) specs.push(['Medidas', dims]);
    if (selected.platform && productKindHasField(p.product_kind, 'platform')) {
      specs.push(['Plataforma', `${selected.platform.name} (${selected.platform.code})`]);
    }
    if (selected.connection && productKindHasField(p.product_kind, 'connectionType')) {
      specs.push(['Conexión', selected.connection.name]);
    }
  }

  return (
    <Screen
      refreshing={product.isRefetching}
      onRefresh={() => {
        product.refetch();
        prices.refetch();
        availability.refetch();
      }}
      footer={
        <View style={{ gap: spacing.sm }}>
          {!user ? (
            <Button title="Inicia sesión para comprar" onPress={() => router.push('/iniciar-sesion')} />
          ) : needsVerification ? (
            <Button title="Verificar mi cuenta profesional" variant="secondary" onPress={() => router.push('/cuenta/verificacion')} />
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <QuantityStepper value={quantity} onChange={setQuantity} disabled={!canAdd} />
              <View style={{ flex: 1 }}>
                <Button
                  title={!selected ? 'Elige una medida' : stock?.status === 'out_of_stock' ? 'Agotado' : added ? 'Agregado ✓' : 'Agregar al carrito'}
                  icon="cart"
                  disabled={!canAdd}
                  loading={addToCart.isPending}
                  onPress={() =>
                    selected &&
                    addToCart.mutate(
                      { variantId: selected.id, quantity },
                      {
                        onSuccess: () => {
                          setAdded(true);
                          setTimeout(() => setAdded(false), 2000);
                        },
                      },
                    )
                  }
                />
              </View>
            </View>
          )}
          {addToCart.isError ? (
            <AppText color="danger" variant="caption">
              {toAppError(addToCart.error).message}
            </AppText>
          ) : null}
        </View>
      }>
      <Stack.Screen
        options={{
          title: kind.label,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              {user ? (
                <IconButton
                  icon={isFavorite ? 'heartFill' : 'heart'}
                  accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  onPress={() => toggleFavorite.mutate({ productId: p.id, favorite: !isFavorite })}
                />
              ) : null}
              <CartButton />
            </View>
          ),
        }}
      />

      {p.media.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ borderRadius: radius.lg }}>
          {p.media.map((m) => (
            <View key={m.storage_path} style={[styles.hero, { backgroundColor: colors.background, borderRadius: radius.lg }]}>
              <Image
                source={{ uri: productMediaUrl(m.storage_path) }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                accessibilityLabel={m.alt_text ?? p.name}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.hero, styles.placeholder, { backgroundColor: colors.background, borderRadius: radius.lg }]}>
          <Icon name="image" size={40} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted">
            Sin fotografía publicada
          </AppText>
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" color="accentText" weight="600">
          {kind.label}
          {p.brand ? ` · ${p.brand.name}` : ''}
        </AppText>
        <AppText variant="headline">{p.name}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {stock ? (
            <Badge
              label={`${AVAILABILITY_LABELS[stock.status]}${stock.available_qty != null && stock.status === 'low_stock' ? ` (${stock.available_qty})` : ''}`}
              tone={stock.status === 'in_stock' ? 'success' : stock.status === 'low_stock' ? 'warning' : 'danger'}
            />
          ) : null}
          {p.requires_professional ? <Badge label="Venta solo a profesionales verificados" tone="info" /> : null}
        </View>
        {p.short_description ? <AppText color="textMuted">{p.short_description}</AppText> : null}
      </View>

      <Card>
        <View style={{ gap: spacing.lg }}>
          <VariantSelector variants={variants} selectedId={selectedId} onSelect={setSelectedId} />
          {selected ? (
            <PriceTag
              gross={price?.unit_price_gross}
              net={price?.unit_price_net}
              visible={!!price?.price_visible}
              size="lg"
              hiddenReason={user ? 'Precio visible solo para profesionales verificados' : 'Inicia sesión para ver precios'}
            />
          ) : variants.length > 1 ? (
            <AppText color="textMuted">
              {anyPriceVisible ? 'Elige una medida para ver su precio y disponibilidad.' : 'Elige una medida para ver su disponibilidad.'}
            </AppText>
          ) : null}
          {price?.price_visible && price.tiers && price.tiers.length > 1 ? (
            <AppText variant="caption" color="textMuted">
              Precio por volumen disponible: el carrito aplica automáticamente el tramo que corresponda.
            </AppText>
          ) : null}
        </View>
      </Card>

      {specs.length > 0 ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="title">Especificaciones</AppText>
            {specs.map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <AppText color="textMuted">{label}</AppText>
                <AppText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {kind.isImplant ? <CompatibilityList implantVariantId={selectedId} /> : null}

      {p.description ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="title">Descripción</AppText>
            <AppText>{p.description}</AppText>
          </View>
        </Card>
      ) : null}

      {p.usage_instructions || p.storage_conditions ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            {p.usage_instructions ? (
              <>
                <AppText variant="title">Instrucciones de uso</AppText>
                <AppText>{p.usage_instructions}</AppText>
              </>
            ) : null}
            {p.storage_conditions ? (
              <>
                <AppText variant="title">Almacenamiento</AppText>
                <AppText>{p.storage_conditions}</AppText>
              </>
            ) : null}
          </View>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card>
          <AppText variant="title">Documentación técnica</AppText>
          {documents.map((d, i) => (
            <View key={d.id}>
              {i > 0 ? <Divider /> : null}
              <ListItem
                icon="document"
                title={d.title}
                subtitle={d.version ? `Versión ${d.version}` : undefined}
                onPress={() => Linking.openURL(d.external_url)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <WhatsAppButton message={whatsappMessages.product({ productName: p.name, sku: selected?.sku })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 4 / 3, minWidth: 280, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
});
