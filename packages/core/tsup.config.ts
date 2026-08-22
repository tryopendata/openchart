import { defineConfig } from 'tsup';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  onSuccess: async () => {
    const src = resolve('src/styles/index.css');
    const dest = resolve('dist/styles.css');
    mkdirSync(dirname(dest), { recursive: true });
    execSync(
      `lightningcss --bundle --minify --sourcemap --targets '>= 0.25%' ${src} -o styles.css`,
      { stdio: 'inherit', cwd: dirname(dest) },
    );
  },
});
