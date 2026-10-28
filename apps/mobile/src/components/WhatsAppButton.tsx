import { buildWhatsAppUrl, isWithinBusinessHours } from '@repo/domain';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { usePublicSettings } from '@/features/settings/api';

/**
 * Abre WhatsApp con un mensaje prellenado (WSP-01..03). Solo se muestra si el negocio configuró
 * un número. Abrir WhatsApp NO significa que el mensaje se envió: lo envía el usuario.
 */
export function WhatsAppButton({ message, label = 'Consultar a un asesor' }: { message: string; label?: string }) {
  const settings = usePublicSettings();
  const [error, setError] = useState<string | null>(null);
  const phone = settings.data?.whatsapp;
  if (!phone) return null;
  const hours = settings.data?.businessHours ?? [];
  const open = hours.length === 0 || isWithinBusinessHours(hours, new Date());

  return (
    <View style={{ gap: 6 }}>
      <Button
        title={label}
        icon="chat"
        variant="outline"
        onPress={async () => {
          setError(null);
          try {
            await Linking.openURL(buildWhatsAppUrl(phone, message));
          } catch {
            setError('No pudimos abrir WhatsApp en este dispositivo.');
          }
        }}
      />
      <AppText variant="caption" color="textMuted">
        Se abrirá WhatsApp con el mensaje listo; tú decides si enviarlo.
        {open ? '' : ' Estamos fuera del horario de atención: responderemos en el próximo horario hábil.'}
      </AppText>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
