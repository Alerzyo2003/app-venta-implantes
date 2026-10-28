import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { AppText } from './Text';

export function Checkbox({
  checked,
  onChange,
  label,
  error,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  error?: string;
  disabled?: boolean;
}) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: !!disabled }}
        onPress={() => !disabled && onChange(!checked)}
        style={styles.row}
        hitSlop={4}>
        <View
          style={[
            styles.box,
            {
              borderColor: error ? colors.danger : checked ? colors.primary : colors.border,
              backgroundColor: checked ? colors.primary : colors.background,
              borderRadius: radius.sm,
            },
          ]}>
          {checked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
        </View>
        <View style={{ flex: 1 }}>{typeof label === 'string' ? <AppText>{label}</AppText> : label}</View>
      </Pressable>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, paddingVertical: 4 },
  box: { width: 24, height: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
