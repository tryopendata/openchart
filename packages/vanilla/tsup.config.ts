import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { bunSymlinkResolver } from '../../scripts/bun-symlink-resolver';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@opendata-ai/openchart-engine', '@opendata-ai/openchart-core'],
  noExternal: [/^d3-/],
  esbuildPlugins: [bunSymlinkResolver(/^d3-/)],
  onSuccess: async () => {
    const src = resolve('node_modules/@opendata-ai/openchart-core/dist/styles.css');
    const dest = resolve('dist/styles.css');
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  },
});
