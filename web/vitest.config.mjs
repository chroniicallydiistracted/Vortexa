import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Broaden include to cover new state, ui, a11y, map suites
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
});
