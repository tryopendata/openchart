import path from 'node:path';
import { defineConfig } from 'vitest/config';

const packages = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: [
      // Workspace packages -> source (so side-effect imports fire)
      { find: '@opendata-ai/openchart-core', replacement: `${packages}/core/src/index.ts` },
      { find: '@opendata-ai/openchart-engine', replacement: `${packages}/engine/src/index.ts` },
      // Subpath first so the exact-string vanilla alias below doesn't swallow it.
      {
        find: '@opendata-ai/openchart-vanilla/story',
        replacement: `${packages}/vanilla/src/story/index.ts`,
      },
      { find: '@opendata-ai/openchart-vanilla', replacement: `${packages}/vanilla/src/index.ts` },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
