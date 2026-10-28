import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta del panel contra la base PostgreSQL local y el emulador de Supabase
 * (tools/local-api). Requiere la base local iniciada: `pnpm db:start`. Reinicia la base al comenzar.
 * El emulador NO reemplaza las pruebas contra un proyecto Supabase real (ver README).
 */
const PORT = 3201;
const API_PORT = 54331;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../../tools/local-api/server.mjs',
      url: `http://127.0.0.1:${API_PORT}/__health`,
      reuseExistingServer: false,
      env: { LOCAL_API_PORT: String(API_PORT) },
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
      url: `http://127.0.0.1:${PORT}/login`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        SUPABASE_URL: `http://127.0.0.1:${API_PORT}`,
        SUPABASE_ANON_KEY: 'clave-publicable-local-de-prueba',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
