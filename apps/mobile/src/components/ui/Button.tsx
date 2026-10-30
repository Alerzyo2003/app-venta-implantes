import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'sm';
  loading?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  fullWidth = true,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const { colors, radius, spacing, card } = useAppTheme();
  const isDisabled = disabled || loading;

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    outline: { bg: card, fg: colors.primary, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.danger, fg: colors.textInverse, border: colors.danger },
  }[variant];

  const height = size === 'lg' ? 56 : size === 'sm' ? 40 : 52;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: size === 'sm' ? radius.sm + 2 : radius.md,
          paddingHorizontal: spacing.xl,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={18} color={palette.fg} /> : null}
          <AppText variant="label" weight="700" style={{ color: palette.fg }}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  badge,
  color,
  disabled,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  badge?: number;
  color?: string;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${accessibilityLabel}, ${badge} unidades` : accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={24} color={color ?? colors.primary} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <AppText variant="caption" weight="700" style={{ color: colors.onAccent, fontSize: 11, lineHeight: 14 }}>
            {badge > 99 ? '99+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
