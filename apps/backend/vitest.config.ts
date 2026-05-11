import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@db': path.resolve(__dirname, '../../packages/database/dist/index'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    // Default suite is fast + deterministic. Network-bound E2E (scraper gold standard)
    // lives under scripts/ and runs via `npm run test:scraper`.
    // The Faza D legacy-solver-baseline test self-skips unless RUN_GOLD_STANDARD=1
    // is set; it is invoked via `npm run test:goldstandard`.
    exclude: ['dist/**', 'node_modules/**', 'scripts/**'],
    testTimeout: 15000, // smoke tests need more time (solver 7-day plans)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**/*.ts', 'src/utils/**/*.ts', 'src/import/**/*.ts'],
      exclude: [
        'src/utils/redis.ts',
        'src/utils/email.ts',
        'src/utils/pdf.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
