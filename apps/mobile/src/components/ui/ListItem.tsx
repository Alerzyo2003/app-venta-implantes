import { Pressable, View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

export function ListItem({
  title,
  subtitle,
  icon,
  onPress,
  right,
  destructive,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const { colors, spacing, radius, fill } = useAppTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm }}>
      {icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.sm + 4,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: destructive ? colors.dangerSurface : fill,
          }}>
          <Icon name={icon} size={20} color={destructive ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight="600" color={destructive ? 'danger' : 'text'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={18} color={colors.textMuted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="title">{title}</AppText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <AppText variant="label" style={{ color: colors.accentText }}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  const { fill } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: fill }} />;
}
