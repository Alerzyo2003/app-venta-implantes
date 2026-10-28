import { expect, type Locator, type Page } from '@playwright/test';

/** Contraseña de las cuentas de PRUEBA creadas por global-setup (solo base local). */
export const TEST_PASSWORD = 'Prueba-Local-2026';
/** Código TOTP aceptado por el emulador local (tools/local-api). */
export const TEST_TOTP_CODE = '123456';

export const USERS = {
  admin: { email: 'admin@prueba.local', name: 'Administradora de prueba', roles: ['admin_general'] },
  inventory: { email: 'bodega@prueba.local', name: 'Encargado de bodega de prueba', roles: ['inventario'] },
  customer: { email: 'cliente@prueba.local', name: 'Cliente de prueba', roles: [] as string[] },
} as const;

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** Completa la verificación en dos pasos (enrolando el factor si es la primera vez). */
export async function completeMfa(page: Page) {
  await page.waitForURL('**/mfa**');
  const configure = page.getByRole('button', { name: 'Configurar verificación' });
  if (await configure.isVisible()) {
    await configure.click();
    await expect(page.getByAltText(/Código QR/)).toBeVisible();
  }
  await page.getByLabel('Código de verificación').fill(TEST_TOTP_CODE);
  await page.getByRole('button', { name: /Activar y continuar|Verificar/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/mfa'));
}

export async function loginStaff(page: Page, email: string) {
  await login(page, email);
  await completeMfa(page);
}

/** Mensajes de alerta de la página (excluye el anunciador de rutas de Next, que también es role=alert). */
export function alerts(scope: Page | Locator): Locator {
  return scope.locator('[role=alert]:not(#__next-route-announcer__)');
}
