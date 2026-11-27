/**
 * Assert that a consumer who imports one thing pays for that one thing.
 *
 * Two checks against the built `dist` output (run `bun run build` first):
 *
 * 1. Residue. Bundle a bare `import '<entry>'` with the package's own files
 *    treated as side-effectful, so the only code left is what a bundler cannot
 *    prove is free of side effects: top-level registration calls, unannotated
 *    `const X = build()` initialisers, `forwardRef(...)` components. Each
 *    package may leave at most RESIDUE_BUDGET bytes of its own code behind.
 *
 * 2. Single-import size. Bundle one named import per mount type and hold the
 *    minified size under a budget, and fail when code that import must never
 *    need shows up in it.
 *
 * Usage:
 *   node scripts/check-tree-shaking.mjs                  # every check
 *   node scripts/check-tree-shaking.mjs --package core   # one package's residue
 *   node scripts/check-tree-shaking.mjs --package core --show
 *       # also print the surviving top-level code of that package
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.resolve('tsup'));
const { build } = require('esbuild');

const SCOPE = '@opendata-ai/openchart-';

/** Peers and host frameworks a consumer supplies; never part of our weight. */
const EXTERNAL = [
  'gifenc',
  'happy-dom',
  'three',
  '3d-force-graph',
  'three-spritetext',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'vue',
];

/** Bytes of its own code a package may leave behind in a bare import. */
const RESIDUE_BUDGET = 1024;

/** [package directory, import specifier]. Svelte ships uncompiled components. */
const RESIDUE_ENTRIES = [
  ['core', `${SCOPE}core`],
  ['engine', `${SCOPE}engine`],
  ['vanilla', `${SCOPE}vanilla`],
  ['vanilla', `${SCOPE}vanilla/static`],
  ['vanilla', `${SCOPE}vanilla/story`],
  ['react', `${SCOPE}react`],
  ['vue', `${SCOPE}vue`],
];

/**
 * Single-import budgets, in minified bytes.
 * `forbid` lists identifiers that must not survive in that bundle.
 */
const IMPORT_BUDGETS = [];

function packageOf(inputPath) {
  const own = inputPath.match(/packages\/(\w+)\/dist\//);
  if (own) return own[1];
  const dep = inputPath.match(/node_modules\/(?:\.bun\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
  return dep ? dep[1] : inputPath;
}

/** Treat every file in one package's dist as side-effectful. */
function forceSideEffects(pkg) {
  return {
    name: 'force-side-effects',
    setup(b) {
      b.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData?.skip) return undefined;
        const resolved = await b.resolve(args.path, {
          resolveDir: args.resolveDir,
          kind: args.kind,
          importer: args.importer,
          pluginData: { skip: true },
        });
        if (resolved.errors.length > 0 || resolved.external) return resolved;
        const own = resolved.path.includes(`/packages/${pkg}/dist/`);
        return { path: resolved.path, sideEffects: own ? true : resolved.sideEffects };
      });
    },
  };
}

async function residue(pkg, specifier) {
  const result = await build({
    stdin: { contents: `import '${specifier}';`, resolveDir: resolve('packages', pkg) },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'error',
    external: EXTERNAL,
    plugins: [forceSideEffects(pkg)],
  });
  const output = Object.values(result.metafile.outputs)[0];
  const byPackage = {};
  for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
    const key = packageOf(input);
    byPackage[key] = (byPackage[key] ?? 0) + bytesInOutput;
  }
  return { own: byPackage[pkg] ?? 0, byPackage, text: result.outputFiles[0].text };
}

/** The sections of an unminified bundle that came from one package's dist. */
function ownSections(text, pkg) {
  const out = [];
  let keep = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('// ')) keep = line.includes(`packages/${pkg}/dist/`) || line.startsWith('// dist/');
    if (keep) out.push(line.length > 160 ? `${line.slice(0, 160)}…` : line);
  }
  return out.join('\n');
}

async function singleImport({ pkg, specifier, name }) {
  const result = await build({
    stdin: {
      contents: `import { ${name} } from '${specifier}'; console.log(${name});`,
      resolveDir: resolve('packages', pkg),
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'error',
    external: EXTERNAL,
  });
  const bytes = result.outputFiles[0].contents;
  return { bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}

async function survivors({ pkg, specifier, name }, identifiers) {
  if (identifiers.length === 0) return [];
  const result = await build({
    stdin: {
      contents: `import { ${name} } from '${specifier}'; console.log(${name});`,
      resolveDir: resolve('packages', pkg),
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'error',
    external: EXTERNAL,
  });
  const text = result.outputFiles[0].text;
  return identifiers.filter((id) => new RegExp(`\\b(?:function|var|const|class) ${id}\\b`).test(text));
}

const args = process.argv.slice(2);
const only = args.includes('--package') ? args[args.indexOf('--package') + 1] : undefined;
const show = args.includes('--show');
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const failures = [];

console.log(`Residue of a bare import (budget ${RESIDUE_BUDGET} bytes of own code per entry)`);
for (const [pkg, specifier] of RESIDUE_ENTRIES) {
  if (only && pkg !== only) continue;
  const { own, byPackage, text } = await residue(pkg, specifier);
  const others = Object.entries(byPackage)
    .filter(([key, bytes]) => key !== pkg && bytes > 512)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, bytes]) => `${key} ${kb(bytes)}`)
    .join(', ');
  const ok = own <= RESIDUE_BUDGET;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${specifier.padEnd(40)} own ${String(own).padStart(8)} bytes${others ? `  (pulls in: ${others})` : ''}`,
  );
  if (!ok) failures.push(`${specifier}: ${own} bytes of ${pkg} survive a bare import`);
  if (show) console.log(ownSections(text, pkg));
}

if (!only) {
  console.log('\nSingle named import, minified');
  for (const budget of IMPORT_BUDGETS) {
    const { bytes, gzipBytes } = await singleImport(budget);
    const leaked = await survivors(budget, budget.forbid ?? []);
    const ok = bytes <= budget.maxBytes && leaked.length === 0;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${`${budget.name} from ${budget.specifier.replace(SCOPE, '')}`.padEnd(34)} ${kb(bytes).padStart(10)} (${kb(gzipBytes)} gzip), budget ${kb(budget.maxBytes)}`,
    );
    if (bytes > budget.maxBytes)
      failures.push(`${budget.name}: ${bytes} bytes exceeds budget ${budget.maxBytes}`);
    for (const id of leaked) failures.push(`${budget.name}: ${id} must not be in this bundle`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} tree-shaking failure(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
