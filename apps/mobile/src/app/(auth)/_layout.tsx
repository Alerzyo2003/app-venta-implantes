import { router, Stack } from 'expo-router';

import { IconButton } from '@/components/ui';
import { useAppTheme } from '@/theme/theme';

export default function AuthLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.surface },
        headerRight: () => (
          <IconButton
            icon="close"
            accessibilityLabel="Cerrar"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ),
      }}>
      <Stack.Screen name="iniciar-sesion" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="recuperar-clave" options={{ title: 'Recuperar contraseña' }} />
      <Stack.Screen name="nueva-clave" options={{ title: 'Nueva contraseña' }} />
    </Stack>
  );
}
