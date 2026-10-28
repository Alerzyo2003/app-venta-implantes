import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Las pruebas comparten una base de datos: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
