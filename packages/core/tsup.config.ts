import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { bunSymlinkResolver } from '../../build/bun-symlink-resolver';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  noExternal: [/^d3-/, 'internmap'],
  esbuildPlugins: [bunSymlinkResolver()],
  onSuccess: async () => {
    const src = resolve('src/styles/viz.css');
    const dest = resolve('dist/styles.css');
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  },
});
