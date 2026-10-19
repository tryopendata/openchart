/**
 * Capture v8 compile output for the v9 migration parity test.
 *
 * Usage: bun run test:parity:capture   (or: node scripts/capture-v8-parity.mjs [tag])
 *
 * What it does:
 *   1. Checks that every package tag of the release (`core-vX`, `engine-vX`, ...)
 *      points at one commit, then adds a detached temporary git worktree at that
 *      tag (default `engine-v8.9.1`) under the OS temp dir.
 *   2. Runs `bun install` and `bun run build` there (the example stories import
 *      the built packages).
 *   3. Copies `examples/src/__tests__/parity-signature.ts` from this checkout into
 *      the worktree, so v8 and v9 extract signatures with identical code, and
 *      writes a throwaway vitest file next to it. That file collects every authored
 *      spec from the v8 stories' `__authoredValues` (same collect() as
 *      migration-parity.test.ts), round-trips each through JSON, and compiles the
 *      round-tripped spec with v8's compile functions at widths 390 and 1280,
 *      height 400, with the engine's default text estimator and TZ=UTC. The v9
 *      test compiles the same JSON the same way.
 *   4. Writes `examples/src/__tests__/__fixtures__/v8-parity.json.gz` with
 *      `{ tag, commit, entries: [{ name, width, spec, signature }], skipped }`,
 *      then removes the worktree.
 *
 * TopoJSON objects imported from us-atlas/world-atlas are stored as
 * `{ "$topology": "<module>" }` references and re-imported by the test (both
 * trees pin the same atlas versions). Specs that cannot be serialized, or that
 * v8 itself fails to compile, are skipped and listed under `skipped`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2] ?? 'engine-v8.9.1';
const version = tag.replace(/^engine-/, '');
const output = path.join(root, 'examples/src/__tests__/__fixtures__/v8-parity.json.gz');

const run = (cmd, args, cwd, env = {}) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const packages = ['core', 'engine', 'vanilla', 'react', 'vue', 'svelte'];
const commits = new Set(packages.map((pkg) => git('rev-list', '-n1', `${pkg}-${version}`)));
if (commits.size !== 1) throw new Error(`${version} package tags point at different commits.`);
const [commit] = commits;

const temp = mkdtempSync(path.join(os.tmpdir(), 'oc-v8-parity-'));
const tree = path.join(temp, 'openchart');
const raw = path.join(temp, 'v8-parity.json');

const captureTest = `/// <reference types="vite/client" />
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import usCountiesAlbers from 'us-atlas/counties-albers-10m.json';
import usStates from 'us-atlas/states-10m.json';
import usStatesAlbers from 'us-atlas/states-albers-10m.json';
import worldCountries from 'world-atlas/countries-110m.json';
import {
  compileBarList,
  compileChart,
  compileGeoMap,
  compileGraph,
  compileLayer,
  compileSankey,
  compileTable,
  compileTileMap,
} from '../../../packages/engine/src/compile';
import { signature } from './parity-signature';

const topologies = new Map<unknown, string>([
  [usCountiesAlbers, 'us-atlas/counties-albers-10m.json'],
  [usStates, 'us-atlas/states-10m.json'],
  [usStatesAlbers, 'us-atlas/states-albers-10m.json'],
  [worldCountries, 'world-atlas/countries-110m.json'],
]);
const byName = new Map([...topologies].map(([value, name]) => [name, value]));

const modules = import.meta.glob('../**/*.{stories,layouts}.tsx', { eager: true }) as Record<
  string,
  { __authoredValues: Record<string, unknown> }
>;
const fixtures: Array<{ name: string; spec: any }> = [];
const seen = new Set<object>();
function collect(value: unknown, name: string) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const record = value as Record<string, unknown>;
  if (
    Array.isArray(record.layer) ||
    (record.data &&
      ((record.mark && record.encoding) ||
        ['table', 'graph', 'sankey', 'map', 'barlist', 'tilemap'].includes(String(record.type))))
  ) {
    fixtures.push({ name, spec: value });
    return;
  }
  for (const [key, child] of Object.entries(record)) collect(child, \`\${name}.\${key}\`);
}
for (const [file, module] of Object.entries(modules)) collect(module.__authoredValues, file);

function compile(spec: any, width: number) {
  const options = { width, height: 400, onWarn: () => {} };
  if ('layer' in spec) return compileLayer(spec, options);
  if ('mark' in spec) return compileChart(spec, options);
  switch (spec.type) {
    case 'table':
      return compileTable(spec, options);
    case 'graph':
      return compileGraph(spec, options);
    case 'sankey':
      return compileSankey(spec, options);
    case 'map':
      return compileGeoMap(spec, options);
    case 'barlist':
      return compileBarList(spec, options);
    case 'tilemap':
      return compileTileMap(spec, options);
  }
  throw new Error('unknown spec kind');
}

const hydrate = (json: string) =>
  JSON.parse(json, (_key, value) =>
    value && typeof value === 'object' && typeof value.$topology === 'string'
      ? byName.get(value.$topology)
      : value,
  );

it('captures v8 parity signatures', () => {
  if (new Date(0).getTimezoneOffset() !== 0) throw new Error('Run with TZ=UTC');
  const entries: unknown[] = [];
  const skipped: Array<{ name: string; width?: number; reason: string }> = [];
  for (const { name, spec } of fixtures) {
    let json: string;
    try {
      json = JSON.stringify(spec, (_key, value) =>
        topologies.has(value) ? { $topology: topologies.get(value) } : value,
      );
    } catch (error) {
      skipped.push({ name, reason: \`not serializable: \${(error as Error).message}\` });
      continue;
    }
    for (const width of [390, 1280]) {
      try {
        const layout = compile(hydrate(json), width);
        entries.push({ name, width, spec: JSON.parse(json), signature: signature(layout) });
      } catch (error) {
        skipped.push({ name, width, reason: \`v8 compile failed: \${(error as Error).message}\` });
      }
    }
  }
  writeFileSync(process.env.PARITY_OUT!, JSON.stringify({ entries, skipped }));
}, 600_000);
`;

try {
  console.log(`Creating worktree for ${tag} (${commit}) in ${tree}`);
  git('worktree', 'add', '--detach', tree, tag);
  run('bun', ['install', '--frozen-lockfile'], tree);
  run('bun', ['run', 'build'], tree);
  const tests = path.join(tree, 'examples/src/__tests__');
  copyFileSync(
    path.join(root, 'examples/src/__tests__/parity-signature.ts'),
    path.join(tests, 'parity-signature.ts'),
  );
  writeFileSync(path.join(tests, 'v8-parity-capture.test.ts'), captureTest);
  run(
    'bunx',
    ['vitest', 'run', '--config', 'vitest.config.ts', 'src/__tests__/v8-parity-capture.test.ts'],
    path.join(tree, 'examples'),
    { TZ: 'UTC', PARITY_OUT: raw },
  );
  const captured = JSON.parse(readFileSync(raw, 'utf8'));
  const payload = JSON.stringify({ tag, commit, ...captured });
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, gzipSync(payload, { level: 9 }));
  const names = new Set(captured.entries.map((entry) => entry.name));
  console.log(
    `Captured ${captured.entries.length} signatures (${names.size} specs x widths); ` +
      `${(payload.length / 1e6).toFixed(1)}MB raw, ` +
      `${(readFileSync(output).length / 1e6).toFixed(1)}MB gzipped -> ${path.relative(root, output)}`,
  );
  for (const skip of captured.skipped)
    console.log(`  skipped ${skip.name}${skip.width ? ` @${skip.width}` : ''}: ${skip.reason}`);
} finally {
  try {
    git('worktree', 'remove', '--force', tree);
  } catch (error) {
    console.error(`Could not remove worktree ${tree}: ${error.message}`);
  }
  rmSync(temp, { recursive: true, force: true });
}
