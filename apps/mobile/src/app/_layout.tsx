import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ConfigMissing } from '@/components/ConfigMissing';
import { EmptyState, Screen } from '@/components/ui';
import { isBackendConfigured } from '@/config/env';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { usePublicSettings } from '@/features/settings/api';
import { queryClient } from '@/lib/query-client';
import { isBelowMinimum } from '@/lib/version';
import { AppThemeProvider, useAppTheme, useHeaderOptions, useNavigationTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { initializing } = useAuth();
  const { colors, scheme } = useAppTheme();
  const navigationTheme = useNavigationTheme();
  const headerOptions = useHeaderOptions();
  const settings = usePublicSettings();
  // Si la fuente no carga (sin red en web, archivo dañado), la app sigue con la del sistema.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (!initializing && fontsReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [initializing, fontsReady]);

  if (!fontsReady) return null;

  if (!isBackendConfigured) return <ConfigMissing />;

  const current = Constants.expoConfig?.version ?? '0.0.0';
  const minimum = Platform.OS === 'ios' ? settings.data?.minVersion.ios : settings.data?.minVersion.android;
  if (Platform.OS !== 'web' && isBelowMinimum(current, minimum)) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          icon="refresh"
          title="Actualización requerida"
          message={`Esta versión (${current}) ya no es compatible. Actualiza la app desde la tienda para continuar.`}
        />
      </Screen>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          ...headerOptions,
          headerBackTitle: 'Atrás',
          contentStyle: { backgroundColor: colors.surface },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="buscar" options={{ title: 'Buscar' }} />
        <Stack.Screen name="escanear" options={{ title: 'Leer código del envase', presentation: 'modal' }} />
        <Stack.Screen name="categoria/[slug]" options={{ title: 'Categoría' }} />
        <Stack.Screen name="producto/[slug]" options={{ title: 'Producto' }} />
        <Stack.Screen name="carrito" options={{ title: 'Carrito' }} />
        <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
        <Stack.Screen name="cuenta/perfil" options={{ title: 'Datos personales' }} />
        <Stack.Screen name="cuenta/direcciones" options={{ title: 'Direcciones' }} />
        <Stack.Screen name="cuenta/direccion" options={{ title: 'Dirección' }} />
        <Stack.Screen name="cuenta/facturacion" options={{ title: 'Datos de facturación' }} />
        <Stack.Screen name="cuenta/facturacion-form" options={{ title: 'Datos de facturación' }} />
        <Stack.Screen name="cuenta/verificacion" options={{ title: 'Verificación profesional' }} />
        <Stack.Screen name="cuenta/preferencias" options={{ title: 'Comunicaciones' }} />
        <Stack.Screen name="cuenta/seguridad" options={{ title: 'Seguridad y cuenta' }} />
      </Stack>
    </ThemeProvider>
  );
}
