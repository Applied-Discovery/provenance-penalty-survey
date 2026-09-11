import { defineConfig } from 'vitest/config';
// test/e2e is excluded here so `npm test` cannot reach the network even with E2E_OSF_STUDY exported;
// `npm run test:datapipe` uses vitest.datapipe.config.ts to run it deliberately.
export default defineConfig({
  test: { globals: true, environment: 'jsdom', include: ['test/**/*.test.ts'], exclude: ['test/e2e/**', '**/node_modules/**'] },
});
