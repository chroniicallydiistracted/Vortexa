import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'scripts/__tests__/**/*.{test,spec}.ts'],
    globals: true,
  },
});
