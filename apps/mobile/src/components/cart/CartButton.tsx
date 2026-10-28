import { router } from 'expo-router';

import { IconButton } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCartSummary } from '@/features/cart/api';

/** Acceso al carrito desde las pantallas comerciales (solo con sesión: el carrito vive en el servidor). */
export function CartButton() {
  const { user } = useAuth();
  const cart = useCartSummary();
  if (!user) return null;
  return (
    <IconButton
      icon="cart"
      accessibilityLabel="Abrir carrito"
      badge={cart.data?.item_count}
      onPress={() => router.push('/carrito')}
    />
  );
}
