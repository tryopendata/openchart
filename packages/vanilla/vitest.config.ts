import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their source so side-effect imports
// (like chart renderer registration in engine/src/index.ts) actually fire.
// The built dist/ files may tree-shake those registrations.
const packages = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@opendata-ai/openchart-core', replacement: `${packages}/core/src/index.ts` },
      { find: '@opendata-ai/openchart-engine', replacement: `${packages}/engine/src/index.ts` },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
