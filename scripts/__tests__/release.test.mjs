import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

for (const reviewed of [true, false]) {
  test(`release dry run uses ${reviewed ? 'reviewed notes' : 'conventional commits'} without writing`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'openchart-release-test-'));
    try {
      await mkdir(join(root, 'scripts'));
      await cp(new URL('../release.mjs', import.meta.url), join(root, 'scripts/release.mjs'));
      for (const name of ['core', 'engine', 'vanilla', 'react', 'vue', 'svelte']) {
        await mkdir(join(root, 'packages', name), { recursive: true });
        await writeFile(join(root, 'packages', name, 'package.json'), '{"version":"8.8.0"}\n');
        await writeFile(join(root, 'packages', name, 'CHANGELOG.md'), '# Changelog\n');
      }
      const changelog = reviewed
        ? '# Changelog\n\n## [8.9.0] - 2026-10-14\n\n### Fixed\n\n- Reviewed release behavior.\n\n## [8.8.0]\n\nOlder notes.\n'
        : '# Changelog\n';
      await writeFile(join(root, 'CHANGELOG.md'), changelog);
      const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
      git('init', '-b', 'main');
      git('config', 'user.email', 'release-test@example.invalid');
      git('config', 'user.name', 'Release test');
      git('config', 'commit.gpgsign', 'false');
      git('add', '.');
      git('commit', '-m', 'release: openchart v8.8.0');
      git('tag', 'core-v8.8.0');
      git('commit', '--allow-empty', '-m', 'feat: fallback release behavior');
      const before = git('rev-parse', 'HEAD');
      const output = execFileSync(process.execPath, ['scripts/release.mjs', 'minor', '--dry-run'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, CI: 'true' },
      });
      assert.match(output, /Releasing: 8\.8\.0 -> 8\.9\.0 \(dry run\)/);
      assert.match(output, reviewed ? /Reviewed release behavior/ : /fallback release behavior/);
      if (reviewed) assert.doesNotMatch(output, /Older notes|fallback release behavior/);
      assert.equal(git('status', '--porcelain'), '');
      assert.equal(git('rev-parse', 'HEAD'), before);
      assert.equal(await readFile(join(root, 'CHANGELOG.md'), 'utf8'), changelog);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
