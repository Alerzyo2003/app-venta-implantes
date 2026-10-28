import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { toAppError } from '@repo/domain';
import { AppState, Platform } from 'react-native';

/** Solo se reintentan errores transitorios (red); los de negocio o permisos no. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return toAppError(error).code === 'NETWORK' && failureCount < 3;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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
