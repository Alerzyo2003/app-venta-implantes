import { expect, test } from '@playwright/test';

import { alerts, completeMfa, login, loginStaff, TEST_TOTP_CODE, USERS } from './fixtures';

test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Guantes de nitrilo talla M';
const SKU = 'GUA-NIT-M-100';

test('una cuenta de cliente no accede al panel', async ({ page }) => {
  await login(page, USERS.customer.email);
  await expect(alerts(page)).toContainText('Esta cuenta no tiene acceso al panel');
  await expect(page).toHaveURL(/\/login/);
  // Las páginas internas siguen exigiendo sesión.
  await page.goto('/productos');
  await expect(page).toHaveURL(/\/login\?next=%2Fproductos/);
});

test('el personal debe activar la verificación en dos pasos', async ({ page }) => {
  await login(page, USERS.admin.email);
  await page.waitForURL('**/mfa**');
  await page.getByRole('button', { name: 'Configurar verificación' }).click();
  await expect(page.getByAltText(/Código QR/)).toBeVisible();
  await page.getByLabel('Código de verificación').fill('000000');
  await page.getByRole('button', { name: 'Activar y continuar' }).click();
  await expect(alerts(page).filter({ hasText: 'incorrecto' })).toBeVisible();

  await page.getByLabel('Código de verificación').fill(TEST_TOTP_CODE);
  await page.getByRole('button', { name: 'Activar y continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible();
  // Resumen con datos reales de la base (catálogo vacío).
  await expect(page.getByText('Publicados')).toBeVisible();
  await expect(page.getByText('Variantes agotadas')).toBeVisible();
  await expect(page.getByText('Verificaciones profesionales pendientes')).toBeVisible();

  // Las cookies de sesión no son accesibles para JavaScript.
  const session = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
  expect(session.length).toBeGreaterThan(0);
  expect(session.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('sb-');
});

test('crear un producto, agregar una variante con precio y publicarlo', async ({ page }) => {
  await loginStaff(page, USERS.admin.email);
  await page.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name: 'Productos' }).click();
  await expect(page.getByText('Aún no hay productos')).toBeVisible();
  await page.getByRole('link', { name: 'Nuevo producto' }).click();

  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByText('El nombre debe tener al menos 2 caracteres.')).toBeVisible();
  await expect(page.getByText('Selecciona una categoría.')).toBeVisible();

  await page.getByLabel('Nombre').fill(PRODUCT);
  await page.getByLabel('Tipo de producto').selectOption('general_supply');
  await page.getByLabel('Categoría').selectOption({ label: 'Insumos odontológicos generales' });
  await page.getByLabel('Descripción breve').fill('Caja de 100 unidades, sin polvo.');
  await page.getByRole('button', { name: 'Crear producto' }).click();

  await expect(page.getByText('Producto creado como borrador')).toBeVisible();
  await expect(page.getByRole('heading', { name: PRODUCT })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0);
  await expect(page.getByText('Para publicar, agrega al menos una variante activa.')).toBeVisible();

  await page.getByRole('link', { name: 'Agregar variante' }).click();
  await page.getByLabel('SKU').fill(SKU);
  await page.getByLabel('Nombre de la variante').fill('Caja 100 unidades');
  await page.getByLabel('GTIN / código de barras').fill('4006381333932');
  await page.getByLabel('Nuevo precio neto (CLP)').fill('12.990');
  await expect(page.getByText('Con IVA: $15.458 por unidad.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Crear variante' }).click();
  await expect(page.getByText('GTIN no válido')).toBeVisible();

  await page.getByLabel('GTIN / código de barras').fill('4006381333931');
  await page.getByRole('button', { name: 'Crear variante' }).click();
  await expect(page.getByText('Variante creada.')).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(SKU) });
  await expect(row).toContainText('$12.990');
  await expect(row).toContainText('04006381333931');

  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Producto publicado')).toBeVisible();

  // Un segundo producto con la misma dirección web se rechaza con un mensaje claro.
  await page.goto('/productos/nuevo');
  await page.getByLabel('Nombre').fill(PRODUCT);
  await page.getByLabel('Categoría').selectOption({ label: 'Insumos odontológicos generales' });
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(alerts(page)).toContainText('Ya existe un producto con esa dirección web');
  // Tras el error, el formulario conserva lo ingresado, incluidos los selectores.
  await expect(page.getByLabel('Nombre')).toHaveValue(PRODUCT);
  await expect(page.getByLabel('Categoría').locator('option:checked')).toHaveText('Insumos odontológicos generales');

  await page.goto('/productos?q=nitrilo');
  await expect(page.getByRole('row', { name: new RegExp(PRODUCT) })).toContainText('Publicado');
  await page.goto(`/productos?q=${SKU.toLowerCase()}`);
  await expect(page.getByRole('link', { name: PRODUCT })).toBeVisible();
});

test('bodega, ingreso, ajuste con motivo y libro de movimientos', async ({ page }) => {
  await loginStaff(page, USERS.inventory.email);
  const nav = page.getByRole('navigation', { name: 'Secciones del panel' });
  await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Productos', 'Inventario', 'Movimientos', 'Bodegas']);

  await nav.getByRole('link', { name: 'Bodegas' }).click();
  await page.getByLabel('Código').fill('bod-central');
  await page.getByLabel('Nombre').fill('Bodega central de prueba');
  await page.getByLabel('Comuna').selectOption({ label: 'Santiago' });
  await page.getByRole('button', { name: 'Crear bodega' }).click();
  await expect(page.getByText('Bodega creada.')).toBeVisible();
  await expect(page.getByRole('row', { name: /BOD-CENTRAL/ })).toContainText('Santiago');

  await nav.getByRole('link', { name: 'Inventario' }).click();
  const invRow = page.getByRole('row', { name: new RegExp(PRODUCT) });
  await expect(invRow).toContainText('Agotado');
  await invRow.getByRole('link', { name: PRODUCT }).click();

  const receive = page.locator('form', { has: page.getByRole('button', { name: 'Registrar ingreso' }) });
  await receive.getByLabel('Bodega').selectOption({ label: 'BOD-CENTRAL · Bodega central de prueba' });
  await receive.getByLabel('Cantidad').fill('10');
  await receive.getByLabel('Nota (opcional)').fill('Guía de despacho 123');
  await receive.getByRole('button', { name: 'Registrar ingreso' }).click();
  await expect(page.getByText('Ingreso registrado: 10 unidad(es).')).toBeVisible();

  const adjust = page.locator('form', { has: page.getByRole('button', { name: 'Registrar ajuste' }) });
  await adjust.getByLabel('Bodega').selectOption({ label: 'BOD-CENTRAL · Bodega central de prueba' });
  await adjust.getByLabel('Cantidad').fill('50');
  await adjust.getByLabel('Motivo').fill('Producto dañado');
  await adjust.getByRole('button', { name: 'Registrar ajuste' }).click();
  await expect(alerts(adjust)).toContainText('dejaría el stock en negativo');
  await expect(adjust.getByLabel('Bodega').locator('option:checked')).toHaveText('BOD-CENTRAL · Bodega central de prueba');
  await expect(adjust.getByLabel('Motivo')).toHaveValue('Producto dañado');

  await adjust.getByLabel('Cantidad').fill('3');
  await adjust.getByRole('button', { name: 'Registrar ajuste' }).click();
  await expect(page.getByText('Ajuste registrado: -3 unidad(es).')).toBeVisible();

  const balances = page.getByRole('table', { name: 'Saldos por bodega' });
  await expect(balances.getByRole('row', { name: /BOD-CENTRAL/ })).toContainText('7');
  const movements = page.getByRole('table', { name: 'Movimientos de inventario' });
  await expect(movements.getByRole('row')).toHaveCount(3);
  await expect(movements).toContainText('Producto dañado');
  await expect(movements).toContainText(USERS.inventory.name);

  // El rol de inventario consulta el catálogo pero no lo edita.
  await nav.getByRole('link', { name: 'Productos' }).click();
  await expect(page.getByRole('link', { name: 'Nuevo producto' })).toHaveCount(0);
  await page.getByRole('link', { name: PRODUCT }).click();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archivar' })).toHaveCount(0);

  // Inicio: las últimas unidades se reflejan en el resumen.
  await nav.getByRole('link', { name: 'Inicio' }).click();
  await expect(page.getByText('Verificaciones profesionales pendientes')).toHaveCount(0);
});

test('la sesión cerrada vuelve a exigir el ingreso', async ({ page }) => {
  await loginStaff(page, USERS.admin.email);
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/inventario');
  await expect(page).toHaveURL(/\/login\?next=%2Finventario/);
});

test('verificación en dos pasos: un factor ya activo solo pide el código', async ({ page }) => {
  await login(page, USERS.admin.email);
  await page.waitForURL('**/mfa**');
  await expect(page.getByRole('button', { name: 'Configurar verificación' })).toHaveCount(0);
  await completeMfa(page);
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible();
});
