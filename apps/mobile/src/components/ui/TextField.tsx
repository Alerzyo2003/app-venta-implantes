import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fontStyle, useAppTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { AppText } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  /** Muestra un botón para ver/ocultar la contraseña. */
  password?: boolean;
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, helper, password = false, style, editable = true, ...props },
  ref,
) {
  const { colors, radius, spacing, font, fill, scheme } = useAppTheme();
  const [hidden, setHidden] = useState(password);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" weight="600" color="textMuted">
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          {
            borderColor: error ? colors.danger : focused ? colors.primary : scheme === 'dark' ? colors.border : fill,
            borderRadius: radius.md,
            backgroundColor: !editable ? colors.surface : fill,
          },
        ]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: colors.text, fontSize: font.sizes.bodyLarge, ...fontStyle('500'), paddingHorizontal: spacing.lg },
            style,
          ]}
          {...props}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.toggle}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="textMuted">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, minHeight: 54 },
  input: { flex: 1, minHeight: 54 },
  toggle: { paddingHorizontal: 14, height: 54, justifyContent: 'center' },
});
