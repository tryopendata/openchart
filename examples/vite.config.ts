import path from 'node:path';

/**
 * Vite config for Ladle dev server.
 *
 * Aliases workspace packages to their TypeScript source so Vite processes
 * them directly. This enables:
 * - Worker `new URL()` pattern (Vite detects and serves the .ts file)
 * - Hot module replacement for library source changes
 * - No need to rebuild packages during dev
 */
export default {
  resolve: {
    alias: {
      '@openchart/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
      '@openchart/engine': path.resolve(__dirname, '../packages/engine/src/index.ts'),
      '@openchart/vanilla': path.resolve(__dirname, '../packages/vanilla/src/index.ts'),
      '@openchart/react': path.resolve(__dirname, '../packages/react/src/index.ts'),
    },
  },
};
