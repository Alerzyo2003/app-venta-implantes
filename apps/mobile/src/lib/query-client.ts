import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { retryDelay, shouldRetry } from '@/lib/retry';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      retryDelay,
    },
    mutations: {
      // Las mutaciones (carrito, pedidos) no se reintentan solas: el usuario decide.
      retry: false,
    },
  },
});

// Estado de conexión del dispositivo (SYN-02). Solo isConnected: la prueba de alcance de internet
// de NetInfo puede dar falsos negativos en redes que bloquean su URL de verificación.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

// Revalida al volver a la app.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}
