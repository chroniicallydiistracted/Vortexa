import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/__tests__/**/*.test.{js,ts}",
  "web/src/components/__tests__/**/*.{test,spec}.{js,ts,tsx}",
  // service-level tests (proxy, shared, alerts) rely on their own local configs or node env
  "services/proxy/src/**/*.test.{ts,js}",
  "services/alerts/src/**/*.test.{ts,js}",
    ],
  environment: 'jsdom',
  pool: 'forks',
  setupFiles: ['web/vitest.setup.ts']
  },
});
