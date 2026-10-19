import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Resolve React through react-dom so both share one instance under hoisted or
// isolated dependency layouts, without assuming package-local node_modules.
const require = createRequire(import.meta.url);
const reactDomPackage = require.resolve('react-dom/package.json');
const reactDomReal = path.dirname(reactDomPackage);
const reactFromDom = path.dirname(createRequire(reactDomPackage).resolve('react/package.json'));
const packages = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
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
      // React dedup: use react-dom's own copy so CJS require('react') matches
      { find: /^react\/(.*)/, replacement: `${reactFromDom}/$1` },
      { find: /^react$/, replacement: reactFromDom },
      { find: /^react-dom\/(.*)/, replacement: `${reactDomReal}/$1` },
      { find: /^react-dom$/, replacement: reactDomReal },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
