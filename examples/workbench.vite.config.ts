import { defineConfig } from 'vite';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import base from './vite.config';

export default defineConfig({
  ...base,
  base: './',
  server: { host: '127.0.0.1', port: 6007, strictPort: true, open: '/workbench.html' },
  preview: { host: '127.0.0.1', port: 6008, strictPort: true },
  build: { outDir: 'build-workbench', rollupOptions: { input: 'workbench.html' } },
  plugins: [{
    name: 'workbench-entry',
    async writeBundle(options) {
      // Static hosts can serve the same entry at / or /workbench.html.
      const directory = options.dir ?? 'build-workbench';
      await copyFile(path.join(directory, 'workbench.html'), path.join(directory, 'index.html'));
    },
  }],
});
