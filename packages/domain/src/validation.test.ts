import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  billingProfileSchema,
  emailSchema,
  passwordSchema,
  signUpSchema,
} from './validation';

const validSignUp = {
  fullName: '  Ana Pérez  ',
  email: '  Ana.Perez@Ejemplo.CL ',
  phone: '9 1234 5678',
  password: 'claveSegura123',
  passwordConfirm: 'claveSegura123',
  accountType: 'dentist',
  acceptTerms: true,
  acceptPrivacy: true,
  marketingEmail: false,
  marketingWhatsapp: false,
  marketingPush: false,
};

describe('signUpSchema', () => {
  it('acepta datos válidos y normaliza correo, nombre y teléfono', () => {
    const r = signUpSchema.safeParse(validSignUp);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('ana.perez@ejemplo.cl');
      expect(r.data.fullName).toBe('Ana Pérez');
      expect(r.data.phone).toBe('+56912345678');
    }
  });

  it('exige aceptar términos y privacidad', () => {
    const r = signUpSchema.safeParse({ ...validSignUp, acceptTerms: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join('.'))).toContain('acceptTerms');
    }
  });

  it('valida que las contraseñas coincidan', () => {
    const r = signUpSchema.safeParse({ ...validSignUp, passwordConfirm: 'otraClave123' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.join('.') === 'passwordConfirm');
      expect(issue?.message).toBe('Las contraseñas no coinciden.');
    }
  });

  it('rechaza tipo de cuenta desconocido', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, accountType: 'admin' }).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it.each([
    ['corta1', false],
    ['soloLetrasLargas', false],
    ['12345678901', false],
    ['letrasY12345', true],
    ['ñandúRápido2026', true],
  ])('%s → %s', (pw, ok) => {
    expect(passwordSchema.safeParse(pw).success).toBe(ok);
  });
});

describe('emailSchema', () => {
  it('rechaza correos inválidos', () => {
    expect(emailSchema.safeParse('no-es-correo').success).toBe(false);
    expect(emailSchema.safeParse('a@b.cl').success).toBe(true);
  });
});

describe('addressSchema y billingProfileSchema', () => {
  it('valida una dirección', () => {
    const r = addressSchema.safeParse({
      recipientName: 'Clínica Ejemplo',
      phone: '+56 2 2345 6789',
      street: 'Av. Providencia',
      streetNumber: '1234',
      comunaCode: '13123',
      isDefault: true,
    });
    expect(r.success).toBe(true);
  });

  it('exige comuna', () => {
    const r = addressSchema.safeParse({
      recipientName: 'Clínica Ejemplo',
      phone: '+56 2 2345 6789',
      street: 'Av. Providencia',
      streetNumber: '1234',
      comunaCode: '',
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('normaliza y valida el RUT de facturación', () => {
    const ok = billingProfileSchema.safeParse({
      rut: '12.345.678-5',
      businessName: 'Empresa SpA',
      giro: 'Venta de insumos',
      addressLine: 'Calle 123',
      comunaCode: '13101',
      dteEmail: 'dte@empresa.cl',
    });
    expect(ok.success && ok.data.rut).toBe('12345678-5');
    const bad = billingProfileSchema.safeParse({
      rut: '12.345.678-4',
      businessName: 'Empresa SpA',
      giro: 'Venta de insumos',
      addressLine: 'Calle 123',
      comunaCode: '13101',
      dteEmail: 'dte@empresa.cl',
    });
    expect(bad.success).toBe(false);
  });
});
