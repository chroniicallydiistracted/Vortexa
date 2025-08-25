import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/__tests__/**/*.test.{js,ts}",
      "web/src/components/__tests__/**/*.{test,spec}.{js,ts,tsx}",
    ],
  environment: 'jsdom',
  pool: 'forks',
  setupFiles: ['web/vitest.setup.ts']
  },
});
