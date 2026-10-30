import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton } from '@/components/cart/CartButton';
import { Icon } from '@/components/ui';
import { fontStyle, useAppTheme, useHeaderOptions } from '@/theme/theme';

/** Barra inferior: Inicio, Categorías, Favoritos, Pedidos y Mi cuenta (mapa de pantallas §1). */
export default function TabsLayout() {
  const { colors, card, shadow } = useAppTheme();
  const headerOptions = useHeaderOptions();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      // La barra flota sobre el fondo: el área segura inferior se suma como margen, no como relleno.
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        ...headerOptions,
        headerTitleAlign: 'left',
        headerTitleStyle: { ...headerOptions.headerTitleStyle, fontSize: 22, letterSpacing: -0.4 },
        tabBarActiveTintColor: colors.highlight,
        tabBarInactiveTintColor: colors.textMuted,
        // Alto útil de 64 (en vez de 49) para que ícono y etiqueta de 11 pt quepan sin recortarse.
        tabBarStyle: {
          backgroundColor: card,
          borderTopWidth: 0,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          marginHorizontal: 12,
          marginBottom: insets.bottom + 8,
          borderRadius: 24,
          ...shadow.md,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, ...fontStyle('600') },
        headerRight: () => <CartButton />,
      }}>
      {/* Inicio dibuja su propia cabecera de marca. */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', headerShown: false, tabBarIcon: ({ color, size, focused }) => <Icon name={focused ? 'homeFill' : 'home'} color={color} size={size} /> }}
      />
      <Tabs.Screen name="categorias" options={{ title: 'Categorías', tabBarIcon: ({ color, size }) => <Icon name="categories" color={color} size={size} /> }} />
      <Tabs.Screen
        name="favoritos"
        options={{ title: 'Favoritos', tabBarIcon: ({ color, size, focused }) => <Icon name={focused ? 'heartFill' : 'heart'} color={color} size={size} /> }}
      />
      <Tabs.Screen name="pedidos" options={{ title: 'Pedidos', tabBarIcon: ({ color, size }) => <Icon name="orders" color={color} size={size} /> }} />
      <Tabs.Screen name="cuenta" options={{ title: 'Mi cuenta', tabBarIcon: ({ color, size }) => <Icon name="account" color={color} size={size} /> }} />
    </Tabs>
  );
}
