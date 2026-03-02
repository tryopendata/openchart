import path from 'node:path';
import { defineConfig } from 'vitest/config';

const packages = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: [
      // Workspace packages -> source (so side-effect imports fire)
      { find: '@opendata-ai/core', replacement: `${packages}/core/src/index.ts` },
      { find: '@opendata-ai/engine', replacement: `${packages}/engine/src/index.ts` },
      { find: '@opendata-ai/vanilla', replacement: `${packages}/vanilla/src/index.ts` },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
