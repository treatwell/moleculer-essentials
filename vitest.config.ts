import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['example/*'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
