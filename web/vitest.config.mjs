import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/components/__tests__/**/*.{test,spec}.{ts,tsx}'],
  }
});
