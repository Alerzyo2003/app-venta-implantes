import { dimensionsLabel, formatMm } from '@repo/domain';
import { View } from 'react-native';

import { AppText, Chip } from '@/components/ui';
import type { ProductVariant } from '@/features/catalog/api';

/**
 * Selección de variante. Si las variantes tienen diámetro y longitud (implantes), se elige
 * primero el diámetro y luego la longitud; si no, se listan por rótulo o SKU.
 */
export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const dimensional = variants.length > 1 && variants.every((v) => v.diameter_mm != null && v.length_mm != null);

  if (variants.length <= 1) return null;

  if (!dimensional) {
    return (
      <View style={{ gap: 8 }}>
        <AppText variant="label">Variante</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {variants.map((v) => (
            <Chip
              key={v.id}
              label={v.label ?? dimensionsLabel({ diameterMm: v.diameter_mm, lengthMm: v.length_mm }) ?? v.sku}
              selected={v.id === selectedId}
              onPress={() => onSelect(v.id)}
            />
          ))}
        </View>
      </View>
    );
  }

  const diameters = [...new Set(variants.map((v) => Number(v.diameter_mm)))].sort((a, b) => a - b);
  const currentDiameter = selected ? Number(selected.diameter_mm) : null;
  const lengths = variants
    .filter((v) => Number(v.diameter_mm) === currentDiameter)
    .sort((a, b) => Number(a.length_mm) - Number(b.length_mm));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        <AppText variant="label">Diámetro (mm)</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {diameters.map((d) => (
            <Chip
              key={d}
              label={`Ø ${formatMm(d, 1)}`}
              selected={d === currentDiameter}
              onPress={() => {
                const first = variants
                  .filter((v) => Number(v.diameter_mm) === d)
                  .sort((a, b) => Number(a.length_mm) - Number(b.length_mm))[0];
                if (first) onSelect(first.id);
              }}
            />
          ))}
        </View>
      </View>
      {currentDiameter != null ? (
        <View style={{ gap: 8 }}>
          <AppText variant="label">Longitud (mm)</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {lengths.map((v) => (
              <Chip key={v.id} label={formatMm(Number(v.length_mm))} selected={v.id === selectedId} onPress={() => onSelect(v.id)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
