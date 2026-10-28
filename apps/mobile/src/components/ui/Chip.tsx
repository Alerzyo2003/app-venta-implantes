import { Pressable } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { AppText } from './Text';

export function Chip({
  label,
  selected = false,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : colors.background,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        minHeight: 36,
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}>
      <AppText variant="caption" weight="600" style={{ color: selected ? colors.onPrimary : colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}
