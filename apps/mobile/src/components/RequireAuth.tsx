import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { EmptyState, LoadingState, Screen, type IconName } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

/** Muestra el contenido solo con sesión iniciada; si no, invita a iniciar sesión. */
export function RequireAuth({
  children,
  title,
  message,
  icon = 'lock',
}: {
  children: ReactNode;
  title: string;
  message: string;
  icon?: IconName;
}) {
  const { user, initializing } = useAuth();
  if (initializing) return <LoadingState />;
  if (!user) {
    return (
      <Screen>
        <EmptyState icon={icon} title={title} message={message} actionLabel="Iniciar sesión" onAction={() => router.push('/iniciar-sesion')} />
      </Screen>
    );
  }
  return <>{children}</>;
}
