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
      screenOptions={{
        ...headerOptions,
        headerTitleAlign: 'left',
        headerTitleStyle: { ...headerOptions.headerTitleStyle, fontSize: 22, letterSpacing: -0.4 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // La barra ya suma el área segura inferior como padding; solo se amplía el alto útil
        // (60 en vez de 49) para que ícono y etiqueta de 11 pt quepan sin recortarse.
        tabBarStyle: {
          backgroundColor: card,
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingTop: 6,
          ...shadow.md,
        },
        tabBarLabelStyle: { fontSize: 11, ...fontStyle('600') },
        headerRight: () => <CartButton />,
      }}>
      {/* Inicio dibuja su propia cabecera de marca. */}
      <Tabs.Screen name="index" options={{ title: 'Inicio', headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }} />
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
