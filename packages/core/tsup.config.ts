import { defineConfig } from 'tsup';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { bunSymlinkResolver } from '../../scripts/bun-symlink-resolver';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  noExternal: [/^d3-/, 'internmap'],
  esbuildPlugins: [bunSymlinkResolver()],
  onSuccess: async () => {
    const src = resolve('src/styles/index.css');
    const dest = resolve('dist/styles.css');
    mkdirSync(dirname(dest), { recursive: true });
    execSync(
      `lightningcss --bundle --minify --targets '>= 0.25%' ${src} -o ${dest}`,
      { stdio: 'inherit' },
    );
  },
});
