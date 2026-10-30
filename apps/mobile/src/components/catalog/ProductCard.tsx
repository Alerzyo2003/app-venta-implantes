import { AVAILABILITY_LABELS, formatCLP, PRODUCT_KINDS } from '@repo/domain';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ProductImageFallback } from '@/components/catalog/ProductImageFallback';
import { AppText, Icon } from '@/components/ui';
import type { SearchResult } from '@/features/catalog/api';
import { productMediaUrl } from '@/lib/supabase';
import { useAppTheme } from '@/theme/theme';

/** Tarjeta de producto: fila (listas y búsqueda) o mosaico compacto (cuadrícula de inicio). */
export function ProductCard({ item, compact = false, style }: { item: SearchResult; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors, radius, spacing, card, shadow } = useAppTheme();
  const stockColor = item.availability === 'in_stock' ? colors.success : item.availability === 'low_stock' ? colors.warning : colors.danger;
  const hasPrice = item.price_visible && item.min_price_gross != null;
  const priceLabel = !item.price_visible
    ? 'Inicia sesión para ver precios'
    : item.min_price_gross == null
      ? 'Precio no disponible'
      : `${item.variant_count > 1 ? 'Desde ' : ''}${formatCLP(item.min_price_gross)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.brand_name ? `, ${item.brand_name}` : ''}. ${AVAILABILITY_LABELS[item.availability]}.${item.requires_professional ? ' Solo profesionales.' : ''} ${priceLabel}`}
      onPress={() =>
        router.push({
          pathname: '/producto/[slug]',
          params: { slug: item.slug, variante: item.matched_variant_ids.length === 1 ? item.matched_variant_ids[0] : undefined },
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: card,
          borderRadius: radius.lg,
          padding: compact ? spacing.sm : spacing.md,
          gap: compact ? spacing.sm : spacing.md,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          flexDirection: compact ? 'column' : 'row',
          ...shadow.sm,
        },
        style,
      ]}>
      <View
        style={[
          styles.image,
          { backgroundColor: colors.surface, borderRadius: radius.md },
          compact ? { width: '100%', aspectRatio: 1 } : { width: 92, height: 92 },
        ]}>
        {item.image_path ? (
          <Image
            source={{ uri: productMediaUrl(item.image_path) }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ProductImageFallback kind={item.product_kind} compact={!compact} />
        )}
        {item.requires_professional ? (
          <View style={[styles.proTag, { backgroundColor: colors.infoSurface, borderRadius: radius.pill }]}>
            <Icon name="verified" size={12} color={colors.info} />
            <AppText variant="caption" weight="700" style={{ color: colors.info, fontSize: 10, lineHeight: 13 }}>
              Pro
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ flex: compact ? undefined : 1, gap: 4, paddingHorizontal: compact ? spacing.xs : 0, paddingBottom: compact ? spacing.xs : 0 }}>
        <AppText variant="caption" color="accentText" weight="700" numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10.5 }}>
          {PRODUCT_KINDS[item.product_kind].label}
          {item.brand_name ? ` · ${item.brand_name}` : ''}
        </AppText>
        <AppText variant={compact ? 'body' : 'bodyLarge'} weight="700" numberOfLines={2}>
          {item.name}
        </AppText>
        {item.matched_variant_ids.length > 0 && item.variant_count > 1 ? (
          <AppText variant="caption" color="textMuted">
            {item.matched_variant_ids.length} de {item.variant_count} medidas coinciden
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: stockColor }} />
          <AppText variant="caption" color="textMuted" weight="500">
            {AVAILABILITY_LABELS[item.availability]}
          </AppText>
        </View>
        <AppText
          variant={hasPrice ? 'bodyLarge' : 'caption'}
          weight={hasPrice ? '800' : '500'}
          color={hasPrice ? 'primary' : 'textMuted'}
          style={{ marginTop: 2 }}>
          {priceLabel}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  image: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  proTag: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3 },
});
