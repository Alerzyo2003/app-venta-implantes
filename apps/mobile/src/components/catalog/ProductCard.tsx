import { AVAILABILITY_LABELS, formatCLP, PRODUCT_KINDS } from '@repo/domain';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Icon } from '@/components/ui';
import type { SearchResult } from '@/features/catalog/api';
import { productMediaUrl } from '@/lib/supabase';
import { useAppTheme } from '@/theme/theme';

export function ProductCard({ item, compact = false }: { item: SearchResult; compact?: boolean }) {
  const { colors, radius, spacing } = useAppTheme();
  const tone = item.availability === 'in_stock' ? 'success' : item.availability === 'low_stock' ? 'warning' : 'danger';
  const priceLabel = !item.price_visible
    ? 'Inicia sesión para ver precios'
    : item.min_price_gross == null
      ? 'Precio no disponible'
      : `${item.variant_count > 1 ? 'Desde ' : ''}${formatCLP(item.min_price_gross)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.brand_name ? `, ${item.brand_name}` : ''}. ${AVAILABILITY_LABELS[item.availability]}. ${priceLabel}`}
      onPress={() =>
        router.push({
          pathname: '/producto/[slug]',
          params: { slug: item.slug, variante: item.matched_variant_ids.length === 1 ? item.matched_variant_ids[0] : undefined },
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          opacity: pressed ? 0.9 : 1,
          flexDirection: compact ? 'column' : 'row',
        },
      ]}>
      <View
        style={[
          styles.image,
          { backgroundColor: colors.surface, borderRadius: radius.md },
          compact ? { width: '100%', aspectRatio: 1 } : { width: 88, height: 88 },
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
          <Icon name="image" size={28} color={colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="caption" color="accentText" weight="600">
          {PRODUCT_KINDS[item.product_kind].label}
          {item.brand_name ? ` · ${item.brand_name}` : ''}
        </AppText>
        <AppText variant="bodyLarge" weight="600" numberOfLines={2}>
          {item.name}
        </AppText>
        {item.matched_variant_ids.length > 0 && item.variant_count > 1 ? (
          <AppText variant="caption" color="textMuted">
            {item.matched_variant_ids.length} de {item.variant_count} medidas coinciden
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={AVAILABILITY_LABELS[item.availability]} tone={tone} />
          {item.requires_professional ? <Badge label="Solo profesionales" tone="info" /> : null}
        </View>
        <AppText variant="label" color={item.price_visible && item.min_price_gross != null ? 'primary' : 'textMuted'}>
          {priceLabel}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, gap: 12 },
  image: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
