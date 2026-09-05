import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'examples/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/__tests__/**', '**/__test-fixtures__/**', '**/index.ts', '**/*.d.ts'],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 80,
        lines: 75,
      },
    },
  },
});
