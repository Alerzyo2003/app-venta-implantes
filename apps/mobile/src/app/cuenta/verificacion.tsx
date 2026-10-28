import { zodResolver } from '@hookform/resolvers/zod';
import { formatDateTime, PROFESSION_LABELS, PROFESSIONS, professionalVerificationSchema, toAppError } from '@repo/domain';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Badge, Button, Card, Chip, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { useMyVerification, useProfile, useSubmitVerification } from '@/features/account/api';

export default function VerificationScreen() {
  return (
    <RequireAuth title="Verificación profesional" message="Inicia sesión para solicitar tu verificación.">
      <Content />
    </RequireAuth>
  );
}

function Content() {
  const profile = useProfile();
  const verification = useMyVerification();
  const submit = useSubmitVerification();
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(professionalVerificationSchema),
    defaultValues: { profession: 'dentist' as const, rut: '', registryNumber: '' },
  });

  if (profile.isPending || verification.isPending) return <LoadingState />;
  if (profile.isError || verification.isError) {
    return (
      <Screen>
        <ErrorState error={profile.error ?? verification.error} onRetry={() => (profile.refetch(), verification.refetch())} />
      </Screen>
    );
  }

  const status = profile.data?.professional_status;
  const last = verification.data;

  return (
    <Screen>
      <AppText color="textMuted">
        Algunos productos (por ejemplo, implantes) se venden solo a profesionales verificados. El equipo revisa tus antecedentes
        en el Registro Nacional de Prestadores Individuales de Salud.
      </AppText>

      {status === 'verified' ? (
        <Card>
          <View style={{ gap: 8 }}>
            <Badge label="Profesional verificado" tone="success" />
            <AppText>Tu cuenta está verificada. Ya puedes comprar productos exclusivos para profesionales.</AppText>
          </View>
        </Card>
      ) : null}

      {last && status !== 'verified' ? (
        <Card>
          <View style={{ gap: 8 }}>
            <Badge
              label={last.status === 'pending' ? 'Solicitud en revisión' : last.status === 'rejected' ? 'Solicitud rechazada' : 'Solicitud anterior'}
              tone={last.status === 'pending' ? 'warning' : last.status === 'rejected' ? 'danger' : 'neutral'}
            />
            <AppText variant="caption" color="textMuted">
              Enviada el {formatDateTime(last.submitted_at)} · {PROFESSION_LABELS[last.profession]} · Registro {last.registry_number}
            </AppText>
            {last.review_notes ? <AppText>Observación: {last.review_notes}</AppText> : null}
          </View>
        </Card>
      ) : null}

      {status !== 'verified' && status !== 'pending' ? (
        <Card>
          <View style={{ gap: 16 }}>
            <AppText variant="title">Enviar antecedentes</AppText>
            <Controller
              control={control}
              name="profession"
              render={({ field }) => (
                <View style={{ gap: 8 }}>
                  <AppText variant="label">Profesión</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {PROFESSIONS.map((p) => (
                      <Chip key={p} label={PROFESSION_LABELS[p]} selected={field.value === p} onPress={() => field.onChange(p)} />
                    ))}
                  </View>
                </View>
              )}
            />
            <Controller
              control={control}
              name="rut"
              render={({ field }) => (
                <TextField label="RUT" autoCapitalize="characters" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.rut?.message} />
              )}
            />
            <Controller
              control={control}
              name="registryNumber"
              render={({ field }) => (
                <TextField
                  label="N° de registro de prestador individual"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={formState.errors.registryNumber?.message}
                />
              )}
            />
            {submit.isError ? <AppText color="danger">{toAppError(submit.error).message}</AppText> : null}
            <Button
              title="Enviar solicitud"
              loading={submit.isPending}
              onPress={() => void handleSubmit((v) => submit.mutate({ profession: v.profession, rut: v.rut, registryNumber: v.registryNumber }))()}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
