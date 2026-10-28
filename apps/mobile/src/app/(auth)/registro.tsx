import { zodResolver } from '@hookform/resolvers/zod';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  createSignUpSchema,
  PASSWORD_MIN_LENGTH,
  toAppError,
  type SignUpData,
  type SignUpInput,
} from '@repo/domain';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, Card, Checkbox, Chip, EmptyState, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { useSignUp } from '@/features/auth/api';
import { useCurrentLegalDocuments, type LegalDocument } from '@/features/settings/api';

export default function SignUpScreen() {
  const legal = useCurrentLegalDocuments();
  if (legal.isPending) return <LoadingState />;
  if (legal.isError) {
    return (
      <Screen>
        <ErrorState error={legal.error} onRetry={() => legal.refetch()} />
      </Screen>
    );
  }
  return <SignUpForm legalDocs={legal.data} />;
}

function LegalLink({ doc }: { doc: LegalDocument }) {
  return (
    <AppText>
      Acepto {doc.kind === 'terms' ? 'los ' : 'la '}
      <AppText color="accentText" weight="600" accessibilityRole="link" onPress={() => Linking.openURL(doc.url)}>
        {doc.title}
      </AppText>{' '}
      (versión {doc.version})
    </AppText>
  );
}

function SignUpForm({ legalDocs }: { legalDocs: LegalDocument[] }) {
  const terms = legalDocs.find((d) => d.kind === 'terms');
  const privacy = legalDocs.find((d) => d.kind === 'privacy');
  const requireLegal = !!terms && !!privacy;
  const schema = useMemo(() => createSignUpSchema(requireLegal), [requireLegal]);
  const signUp = useSignUp();

  const { control, handleSubmit, formState } = useForm<SignUpInput, unknown, SignUpData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirm: '',
      accountType: 'dentist',
      acceptTerms: false,
      acceptPrivacy: false,
      // Comunicaciones promocionales: siempre desactivadas por defecto (consentimiento expreso).
      marketingEmail: false,
      marketingWhatsapp: false,
      marketingPush: false,
    },
  });

  if (signUp.isSuccess) {
    const needsConfirmation = !signUp.data.session;
    return (
      <Screen>
        <EmptyState
          icon="mail"
          title={needsConfirmation ? 'Confirma tu correo' : 'Cuenta creada'}
          message={
            needsConfirmation
              ? 'Te enviamos un enlace de verificación. Ábrelo desde este dispositivo para activar tu cuenta y luego inicia sesión.'
              : 'Tu cuenta está lista.'
          }
          actionLabel={needsConfirmation ? 'Ir a iniciar sesión' : 'Comenzar'}
          onAction={() => router.replace(needsConfirmation ? '/iniciar-sesion' : '/')}
        />
      </Screen>
    );
  }

  // El resolver entrega los valores ya validados y normalizados (correo en minúsculas, teléfono E.164).
  const onSubmit = handleSubmit((input) => {
    signUp.mutate({ input, legal: { terms: terms?.version, privacy: privacy?.version } });
  });

  const field = (name: 'fullName' | 'email' | 'phone' | 'password' | 'passwordConfirm', label: string, extra: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <TextField
          label={label}
          value={f.value}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          error={formState.errors[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16 }}>
          {field('fullName', 'Nombre completo', { autoComplete: 'name', textContentType: 'name' })}
          {field('email', 'Correo electrónico', {
            autoCapitalize: 'none',
            keyboardType: 'email-address',
            autoComplete: 'email',
            textContentType: 'emailAddress',
          })}
          {field('phone', 'Teléfono', {
            keyboardType: 'phone-pad',
            autoComplete: 'tel',
            placeholder: '+56 9 1234 5678',
            textContentType: 'telephoneNumber',
          })}
          {field('password', 'Contraseña', {
            password: true,
            autoComplete: 'new-password',
            textContentType: 'newPassword',
            helper: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con letras y números.`,
          })}
          {field('passwordConfirm', 'Repite la contraseña', { password: true, autoComplete: 'new-password' })}

          <Controller
            control={control}
            name="accountType"
            render={({ field: f }) => (
              <View style={{ gap: 8 }}>
                <AppText variant="label">Tipo de cuenta</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ACCOUNT_TYPES.map((t) => (
                    <Chip key={t} label={ACCOUNT_TYPE_LABELS[t]} selected={f.value === t} onPress={() => f.onChange(t)} />
                  ))}
                </View>
                <AppText variant="caption" color="textMuted">
                  Algunos productos se venden solo a profesionales verificados. Podrás enviar tus antecedentes desde «Mi cuenta».
                </AppText>
              </View>
            )}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="title">Términos y privacidad</AppText>
          {requireLegal ? (
            <>
              <Controller
                control={control}
                name="acceptTerms"
                render={({ field: f }) => (
                  <Checkbox
                    checked={f.value}
                    onChange={f.onChange}
                    label={<LegalLink doc={terms!} />}
                    error={formState.errors.acceptTerms?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="acceptPrivacy"
                render={({ field: f }) => (
                  <Checkbox
                    checked={f.value}
                    onChange={f.onChange}
                    label={<LegalLink doc={privacy!} />}
                    error={formState.errors.acceptPrivacy?.message}
                  />
                )}
              />
            </>
          ) : (
            <AppText color="textMuted">
              Los términos y la política de privacidad están pendientes de publicación. Te pediremos aceptarlos cuando estén
              disponibles y antes de tu primera compra.
            </AppText>
          )}
        </View>
      </Card>

      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="title">Comunicaciones (opcional)</AppText>
          <AppText variant="caption" color="textMuted">
            Las comunicaciones sobre tus pedidos se envían siempre. Las promocionales solo si las autorizas, y puedes cambiarlas
            cuando quieras.
          </AppText>
          {(
            [
              ['marketingEmail', 'Ofertas y novedades por correo'],
              ['marketingWhatsapp', 'Ofertas y novedades por WhatsApp'],
              ['marketingPush', 'Ofertas y novedades por notificaciones'],
            ] as const
          ).map(([name, label]) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field: f }) => <Checkbox checked={f.value} onChange={f.onChange} label={label} />}
            />
          ))}
        </View>
      </Card>

      {signUp.isError ? (
        <AppText color="danger" accessibilityLiveRegion="polite">
          {toAppError(signUp.error).message}
        </AppText>
      ) : null}
      <Button title="Crear cuenta" size="lg" loading={signUp.isPending} onPress={() => void onSubmit()} />
    </Screen>
  );
}
