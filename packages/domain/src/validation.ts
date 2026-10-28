/**
 * Esquemas de validación compartidos (zod) para los formularios de la app y la web.
 * El servidor vuelve a validar: estos esquemas mejoran la experiencia, no la seguridad.
 */
import { z } from 'zod';
import { normalizeChileanPhone } from './phone';
import { isValidRut, normalizeRut } from './rut';

export const ACCOUNT_TYPES = ['general', 'dentist', 'implantologist', 'clinic', 'commercial'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Readonly<Record<AccountType, string>> = {
  general: 'Cliente general',
  dentist: 'Odontólogo/a',
  implantologist: 'Implantólogo/a',
  clinic: 'Clínica dental',
  commercial: 'Organización comercial',
};

export const PROFESSIONS = ['dentist', 'implantologist', 'dental_specialist', 'other'] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const PROFESSION_LABELS: Readonly<Record<Profession, string>> = {
  dentist: 'Cirujano/a dentista',
  implantologist: 'Especialista en implantología',
  dental_specialist: 'Otra especialidad odontológica',
  other: 'Otra profesión de la salud',
};

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Ingresa un correo electrónico válido.'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(72, 'La contraseña no puede superar 72 caracteres.')
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), 'La contraseña debe incluir letras y números.');

export const phoneSchema = z
  .string()
  .trim()
  .refine(
    (v) => normalizeChileanPhone(v) !== null,
    'Ingresa un teléfono chileno válido, por ejemplo +56 9 1234 5678.',
  )
  .transform((v) => normalizeChileanPhone(v) as string);

export const rutSchema = z
  .string()
  .trim()
  .refine((v) => isValidRut(v), 'El RUT no es válido.')
  .transform((v) => normalizeRut(v) as string);

export const comunaCodeSchema = z.string().regex(/^\d{4,5}$/, 'Selecciona una comuna.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

/**
 * Registro. `requireLegal` exige aceptar términos y privacidad: se usa cuando hay versiones
 * vigentes publicadas (si aún no existen, no se puede aceptar un documento inexistente).
 */
export function createSignUpSchema(requireLegal = true) {
  const acceptance = (message: string) => (requireLegal ? z.literal(true, { error: message }) : z.boolean());
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(3, 'Ingresa tu nombre completo.')
        .max(120, 'El nombre es demasiado largo.'),
      email: emailSchema,
      phone: phoneSchema,
      password: passwordSchema,
      passwordConfirm: z.string(),
      accountType: z.enum(ACCOUNT_TYPES, 'Selecciona un tipo de cuenta.'),
      acceptTerms: acceptance('Debes aceptar los términos y condiciones.'),
      acceptPrivacy: acceptance('Debes aceptar la política de privacidad.'),
      marketingEmail: z.boolean(),
      marketingWhatsapp: z.boolean(),
      marketingPush: z.boolean(),
    })
    .refine((d) => d.password === d.passwordConfirm, {
      error: 'Las contraseñas no coinciden.',
      path: ['passwordConfirm'],
    });
}

export const signUpSchema = createSignUpSchema(true);

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, {
    error: 'Las contraseñas no coinciden.',
    path: ['passwordConfirm'],
  });

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(3, 'Ingresa tu nombre completo.').max(120),
  phone: phoneSchema,
});

export const addressSchema = z.object({
  label: z.string().trim().max(40, 'Máximo 40 caracteres.').optional(),
  recipientName: z.string().trim().min(3, 'Ingresa el nombre de quien recibe.').max(120),
  phone: phoneSchema,
  street: z.string().trim().min(2, 'Ingresa la calle.').max(120),
  streetNumber: z.string().trim().min(1, 'Ingresa el número.').max(20),
  unit: z.string().trim().max(40, 'Máximo 40 caracteres.').optional(),
  comunaCode: comunaCodeSchema,
  reference: z.string().trim().max(200, 'Máximo 200 caracteres.').optional(),
  isDefault: z.boolean(),
});

export const billingProfileSchema = z.object({
  rut: rutSchema,
  businessName: z.string().trim().min(2, 'Ingresa la razón social.').max(150),
  giro: z.string().trim().min(2, 'Ingresa el giro.').max(120),
  addressLine: z.string().trim().min(3, 'Ingresa la dirección.').max(200),
  comunaCode: comunaCodeSchema,
  dteEmail: emailSchema,
});

export const professionalVerificationSchema = z.object({
  profession: z.enum(PROFESSIONS, 'Selecciona tu profesión.'),
  rut: rutSchema,
  registryNumber: z
    .string()
    .trim()
    .min(3, 'Ingresa tu número de registro de prestador.')
    .max(30, 'Máximo 30 caracteres.'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type SignUpInput = z.input<ReturnType<typeof createSignUpSchema>>;
export type SignUpData = z.output<ReturnType<typeof createSignUpSchema>>;
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;
export type BillingProfileInput = z.input<typeof billingProfileSchema>;
export type BillingProfileData = z.output<typeof billingProfileSchema>;
export type ProfessionalVerificationInput = z.input<typeof professionalVerificationSchema>;
