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

/** Declarations that belong to charts; no other mount type may carry them. */
const CHART_ONLY = ['barRenderer', 'lineRenderer', 'pieRenderer', 'validateChartSpec', 'expandChartSugar'];
/** Declarations that belong to one non-chart type each. */
const OTHER_TYPES = {
  sankey: ['compileSankey', 'validateSankeySpec'],
  table: ['compileTableLayout', 'validateTableSpec'],
  graph: ['compileGraph', 'validateGraphSpec'],
  tilemap: ['compileTileMap', 'validateTileMapSpec'],
  map: ['compileGeoMap', 'validateGeoMapSpec'],
  barlist: ['compileBarList', 'validateBarListSpec'],
};
const allBut = (...types) =>
  Object.entries(OTHER_TYPES).flatMap(([type, ids]) => (types.includes(type) ? [] : ids));

const kB = (n) => n * 1024;
const vanilla = (name, maxBytes, forbid) => ({
  pkg: 'vanilla',
  specifier: `${SCOPE}vanilla`,
  name,
  maxBytes,
  forbid,
});
const wrapper = (pkg, name, maxBytes, forbid) => ({
  pkg,
  specifier: `${SCOPE}${pkg}`,
  name,
  maxBytes,
  forbid,
});

/**
 * Single-import budgets, in minified bytes: the measured size when the budget
 * was set plus about 10%. `forbid` lists declarations that must not survive in
 * that bundle. Raise a budget on purpose, in the change that needs it.
 *
 * Chart bundles forbid nothing: `mark` is runtime data, so a chart needs every
 * chart renderer, and its validator is the generic one that knows every type.
 */
const IMPORT_BUDGETS = [
  vanilla('createSankey', kB(193), [...CHART_ONLY, ...allBut('sankey')]),
  vanilla('createTable', kB(174), [...CHART_ONLY, ...allBut('table')]),
  vanilla('createBarList', kB(187), [...CHART_ONLY, ...allBut('barlist')]),
  vanilla('createGraph', kB(231), [...CHART_ONLY, ...allBut('graph')]),
  vanilla('createTileMap', kB(250), [...CHART_ONLY, ...allBut('tilemap')]),
  vanilla('createGeoMap', kB(440), [...CHART_ONLY, ...allBut('map')]),
  vanilla('createChart', kB(866), []),
  wrapper('react', 'Sankey', kB(196), [...CHART_ONLY, ...allBut('sankey')]),
  wrapper('react', 'DataTable', kB(177), [...CHART_ONLY, ...allBut('table')]),
  wrapper('react', 'Chart', kB(906), []),
  wrapper('vue', 'Sankey', kB(196), [...CHART_ONLY, ...allBut('sankey')]),
  wrapper('vue', 'Chart', kB(906), []),
];

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

/**
 * Leave dynamic `import()` targets out of the bundle. They load on demand
 * (GIF export), so they are not part of what an entry costs up front.
 */
const lazyImportsExternal = {
  name: 'lazy-imports-external',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) =>
      args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined,
    );
  },
};

const BUNDLE = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
  metafile: true,
  logLevel: 'error',
  external: EXTERNAL,
};

/** The sections of an unminified bundle that came from one package's dist. */
function ownSections(text, pkg) {
  const out = [];
  let keep = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('// ')) keep = line.includes(`packages/${pkg}/dist/`);
    else if (keep) out.push(line);
  }
  return out.join('\n');
}

/**
 * Own code that survives a bare import. Import statements for externals
 * (`import { forwardRef } from "react"`) are left out: they cost nothing.
 */
async function residue(pkg, specifier) {
  const result = await build({
    ...BUNDLE,
    stdin: { contents: `import '${specifier}';`, resolveDir: resolve('packages', pkg) },
    plugins: [lazyImportsExternal, forceSideEffects(pkg)],
  });
  const pulled = {};
  const output = Object.values(result.metafile.outputs)[0];
  for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
    const owner = packageOf(input);
    if (owner !== pkg) pulled[owner] = (pulled[owner] ?? 0) + bytesInOutput;
  }
  const code = ownSections(result.outputFiles[0].text, pkg)
    .replace(/^import\s[^;]*;$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return { own: Buffer.byteLength(code), pulled, code };
}

/** Bundle one named import the way a consumer's bundler would. */
async function singleImport({ pkg, specifier, name }, minify) {
  const result = await build({
    ...BUNDLE,
    minify,
    stdin: {
      contents: `import { ${name} } from '${specifier}'; console.log(${name});`,
      resolveDir: resolve('packages', pkg),
    },
    plugins: [lazyImportsExternal],
  });
  return result.outputFiles[0];
}

async function measure(budget) {
  const { contents } = await singleImport(budget, true);
  return { bytes: contents.length, gzipBytes: gzipSync(contents).length };
}

/** Which of `identifiers` are still declared in the bundle for this import. */
async function survivors(budget, identifiers) {
  if (identifiers.length === 0) return [];
  const { text } = await singleImport(budget, false);
  return identifiers.filter((id) =>
    new RegExp(`\\b(?:function|var|const|class) ${id}\\b`).test(text),
  );
}

const args = process.argv.slice(2);
const only = args.includes('--package') ? args[args.indexOf('--package') + 1] : undefined;
const show = args.includes('--show');
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const failures = [];

console.log(`Residue of a bare import (budget ${RESIDUE_BUDGET} bytes of own code per entry)`);
for (const [pkg, specifier] of RESIDUE_ENTRIES) {
  if (only && pkg !== only) continue;
  const { own, pulled, code } = await residue(pkg, specifier);
  const others = Object.entries(pulled)
    .filter(([, bytes]) => bytes > 512)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, bytes]) => `${key} ${kb(bytes)}`)
    .join(', ');
  const ok = own <= RESIDUE_BUDGET;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${specifier.padEnd(40)} own ${String(own).padStart(8)} bytes${others ? `  (pulls in: ${others})` : ''}`,
  );
  if (!ok) failures.push(`${specifier}: ${own} bytes of ${pkg} survive a bare import`);
  if (show && code) console.log(code.replace(/^(.{160}).+$/gm, '$1…'));
}

if (!only) {
  console.log('\nSingle named import, minified');
  for (const budget of IMPORT_BUDGETS) {
    const { bytes, gzipBytes } = await measure(budget);
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
