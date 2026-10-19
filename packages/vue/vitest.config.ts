import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const packages = path.resolve(__dirname, '..');
const vanillaRequire = createRequire(path.join(packages, 'vanilla/package.json'));

export default defineConfig({
  resolve: {
    alias: [
      // Wrapper mocks and the real vanilla renderer must resolve the same library
      // instance under Bun's isolated install, even if a hoisted copy also exists.
      ...['three', 'three-spritetext', '3d-force-graph'].map((name) => ({
        find: new RegExp(`^${name}$`),
        replacement: vanillaRequire.resolve(name),
      })),
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
