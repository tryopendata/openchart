/** Build a movable Studio checkout using this revision's real, packed public libraries. */
import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const destination = process.argv[2]
  ? resolve(process.argv[2])
  : await mkdtemp(join(tmpdir(), 'openchart-studio-'));
const run = (args, cwd) => execFileSync('bun', args, { cwd, stdio: 'inherit' });
run(['run', 'build'], root);
await mkdir(destination, { recursive: true });
await cp(join(root, 'apps/studio'), destination, {
  recursive: true,
  filter: (path) =>
    !/(?:^|\/)(?:node_modules|dist|test-results|playwright-report)(?:\/|$)/.test(path),
});
await mkdir(join(destination, 'vendor'), { recursive: true });
const appPath = join(destination, 'package.json');
const app = JSON.parse(await readFile(appPath, 'utf8'));
app.overrides = {};
for (const name of ['core', 'engine', 'vanilla']) {
  const tarball = join(destination, 'vendor', `${name}.tgz`);
  run(['pm', 'pack', '--ignore-scripts', '--filename', tarball], join(root, 'packages', name));
  const id = `@opendata-ai/openchart-${name}`;
  app.dependencies[id] = `file:./vendor/${name}.tgz`;
  app.overrides[id] = `file:./vendor/${name}.tgz`;
}
await writeFile(appPath, `${JSON.stringify(app, null, 2)}\n`);
run(['install'], destination);
// Reject accidental registry fallback, including a nested stale core/engine copy.
const resolvePackage = (id, parent = appPath) =>
  new URL(
    execFileSync(
      process.execPath,
      [
        '--experimental-import-meta-resolve',
        '--input-type=module',
        '-e',
        'console.log(import.meta.resolve(process.argv[1], process.argv[2]))',
        id,
        pathToFileURL(parent).href,
      ],
      { cwd: destination, encoding: 'utf8' },
    ).trim(),
  );
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
for (const name of ['core', 'engine', 'vanilla']) {
  const id = `@opendata-ai/openchart-${name}`;
  const installed = resolvePackage(id);
  if ((await hash(installed)) !== (await hash(join(root, 'packages', name, 'dist/index.js'))))
    throw new Error(`Extraction resolved a different ${id} build`);
  for (const dependency of name === 'vanilla'
    ? ['core', 'engine']
    : name === 'engine'
      ? ['core']
      : []) {
    const dependencyId = `@opendata-ai/openchart-${dependency}`;
    if (
      (await hash(resolvePackage(dependencyId, fileURLToPath(installed)))) !==
      (await hash(resolvePackage(dependencyId)))
    )
      throw new Error(`Extraction contains a stale nested ${dependencyId}`);
  }
}
run(['run', 'typecheck'], destination);
run(['run', 'test'], destination);
run(['run', 'build'], destination);
console.log(
  `Standalone Studio is ready at ${destination}. Commit its generated bun.lock in its future repository. Run bun run test:e2e there for browser verification.`,
);
