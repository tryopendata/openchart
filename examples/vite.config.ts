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
      '@opendata-ai/openchart-core/styles.css': path.resolve(__dirname, '../packages/core/src/styles/index.css'),
      '@opendata-ai/openchart-core': path.resolve(__dirname, '../packages/core/src/index.ts'),
      '@opendata-ai/openchart-engine': path.resolve(__dirname, '../packages/engine/src/index.ts'),
      '@opendata-ai/openchart-vanilla/story': path.resolve(__dirname, '../packages/vanilla/src/story/index.ts'),
      '@opendata-ai/openchart-vanilla': path.resolve(__dirname, '../packages/vanilla/src/index.ts'),
      '@opendata-ai/openchart-react': path.resolve(__dirname, '../packages/react/src/index.ts'),
    },
  },
};
