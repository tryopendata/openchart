/** Assert the product boundary in a real consumer bundle, not just manifests. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.resolve('tsup'));
const { build } = require('esbuild');
const result = await build({
  stdin: {
    contents: "export { createChart } from '@opendata-ai/openchart-vanilla';",
    resolveDir: resolve('packages/vanilla'),
  },
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'esm',
  metafile: true,
  write: false,
  external: ['gifenc', 'happy-dom', 'three', '3d-force-graph', 'three-spritetext'],
});
const inputs = Object.keys(result.metafile.inputs);
for (const file of inputs)
  if (
    /(?:apps\/studio|examples\/|framer-motion|motion-dom|d3-dsv|world-atlas|react-dom|node_modules\/react\/)/.test(
      file,
    )
  )
    throw new Error(`Product code leaked into createChart consumer: ${file}`);
const bytes = result.outputFiles[0].contents;
console.log(
  JSON.stringify(
    {
      entry: 'createChart (public vanilla export)',
      modules: inputs.length,
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      productDependencies: 0,
    },
    null,
    2,
  ),
);
