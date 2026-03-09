import { existsSync, readFileSync, realpathSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { Plugin } from 'esbuild';

/**
 * esbuild plugin that resolves bun-symlinked packages to their real
 * entry points. Bun stores packages in node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>
 * with symlinks that esbuild doesn't always follow correctly. This plugin
 * walks up from the importer to find the package, resolves the symlink,
 * and returns the real entry point.
 */
export function bunSymlinkResolver(filter: RegExp = /^(d3-|internmap)/): Plugin {
  return {
    name: 'bun-symlink-resolver',
    setup(build) {
      build.onResolve({ filter }, (args) => {
        let dir = args.resolveDir || process.cwd();
        while (dir !== dirname(dir)) {
          const candidate = join(dir, 'node_modules', args.path);
          if (existsSync(candidate)) {
            const pkgDir = realpathSync(candidate);
            const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
            const entry = pkgJson.module || pkgJson.main || 'index.js';
            return { path: resolve(pkgDir, entry) };
          }
          dir = dirname(dir);
        }
        return undefined;
      });
    },
  };
}
