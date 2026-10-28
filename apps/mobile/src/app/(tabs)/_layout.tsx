import { brand } from '@repo/brand';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton } from '@/components/cart/CartButton';
import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/theme';

/** Barra inferior: Inicio, Categorías, Favoritos, Pedidos y Mi cuenta (mapa de pantallas §1). */
export default function TabsLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // La barra ya suma el área segura inferior como padding; solo se amplía el alto útil
        // (56 en vez de 49) para que ícono y etiqueta de 11 pt quepan sin recortarse.
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.primary,
        headerRight: () => <CartButton />,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', headerTitle: brand.name, tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="categorias" options={{ title: 'Categorías', tabBarIcon: ({ color, size }) => <Icon name="categories" color={color} size={size} /> }} />
      <Tabs.Screen name="favoritos" options={{ title: 'Favoritos', tabBarIcon: ({ color, size }) => <Icon name="heart" color={color} size={size} /> }} />
      <Tabs.Screen name="pedidos" options={{ title: 'Pedidos', tabBarIcon: ({ color, size }) => <Icon name="orders" color={color} size={size} /> }} />
      <Tabs.Screen name="cuenta" options={{ title: 'Mi cuenta', tabBarIcon: ({ color, size }) => <Icon name="account" color={color} size={size} /> }} />
    </Tabs>
  );
}
