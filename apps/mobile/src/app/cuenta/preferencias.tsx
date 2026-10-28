import { formatDateTime, toAppError } from '@repo/domain';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Card, Checkbox, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useConsents, useSetMarketingConsent, type MarketingChannel } from '@/features/account/api';

const CHANNELS: { key: MarketingChannel; label: string }[] = [
  { key: 'marketing_email', label: 'Ofertas y novedades por correo' },
  { key: 'marketing_whatsapp', label: 'Ofertas y novedades por WhatsApp' },
  { key: 'marketing_push', label: 'Ofertas y novedades por notificaciones' },
];

export default function PreferencesScreen() {
  return (
    <RequireAuth title="Comunicaciones" message="Inicia sesión para gestionar tus preferencias.">
      <Content />
    </RequireAuth>
  );
}

function Content() {
  const consents = useConsents();
  const setConsent = useSetMarketingConsent();
  if (consents.isPending) return <LoadingState />;
  if (consents.isError) {
    return (
      <Screen>
        <ErrorState error={consents.error} onRetry={() => consents.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <AppText color="textMuted">
        Los avisos sobre tus pedidos, pagos y despachos se envían siempre. Las comunicaciones promocionales solo con tu
        autorización; cada cambio queda registrado con su fecha.
      </AppText>
      <Card>
        <View style={{ gap: 12 }}>
          {CHANNELS.map((c) => {
            const current = consents.data[c.key];
            return (
              <View key={c.key} style={{ gap: 2 }}>
                <Checkbox
                  checked={!!current?.granted}
                  disabled={setConsent.isPending}
                  onChange={(granted) => setConsent.mutate({ channel: c.key, granted })}
                  label={c.label}
                />
                {current ? (
                  <AppText variant="caption" color="textMuted" style={{ marginLeft: 36 }}>
                    Última actualización: {formatDateTime(current.created_at, { withTime: true })}
                  </AppText>
                ) : null}
              </View>
            );
          })}
          {setConsent.isError ? <AppText color="danger">{toAppError(setConsent.error).message}</AppText> : null}
        </View>
      </Card>
    </Screen>
  );
}
