import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Bun isolates each dependency's copies of react / react-dom in separate
// .bun/ cache directories. When react-dom does `require('react')` internally,
// it gets its own copy rather than the one our source code uses. This causes
// React's "Invalid hook call" error (two React instances).
//
// Fix: resolve the REAL path of react-dom, then alias `react` to the copy
// that lives alongside it. Now our code and react-dom use the same object.
const reactDomReal = fs.realpathSync(path.resolve(__dirname, 'node_modules/react-dom'));
const reactFromDom = path.resolve(reactDomReal, '../react');
const packages = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      // Workspace packages -> source (so side-effect imports fire)
      { find: '@openchart/core', replacement: `${packages}/core/src/index.ts` },
      { find: '@openchart/engine', replacement: `${packages}/engine/src/index.ts` },
      { find: '@openchart/vanilla', replacement: `${packages}/vanilla/src/index.ts` },
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
