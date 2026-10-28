import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { AppText } from './Text';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const { colors, radius } = useAppTheme();
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Cantidad"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.row, { borderColor: colors.border, borderRadius: radius.md, opacity: disabled ? 0.5 : 1 }]}>
      <Pressable
        accessibilityLabel="Disminuir cantidad"
        disabled={disabled || value <= min}
        onPress={() => step(-1)}
        style={styles.button}
        hitSlop={4}>
        <Icon name="minus" size={18} color={value <= min ? colors.textMuted : colors.primary} />
      </Pressable>
      <AppText variant="label" style={styles.value}>
        {value}
      </AppText>
      <Pressable
        accessibilityLabel="Aumentar cantidad"
        disabled={disabled || value >= max}
        onPress={() => step(1)}
        style={styles.button}
        hitSlop={4}>
        <Icon name="plus" size={18} color={value >= max ? colors.textMuted : colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 32, textAlign: 'center' },
});
