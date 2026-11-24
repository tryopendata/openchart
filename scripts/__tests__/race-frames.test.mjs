import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function geometryDemo(...args) {
  return spawnSync('bun', ['scripts/race-frames.ts', '--geometry', ...args], {
    cwd: new URL('../../', import.meta.url),
    encoding: 'utf8',
  });
}

test('rejects unknown and missing race marks with the supported values', () => {
  for (const args of [['--mark', 'pie'], ['--mark']]) {
    const { status, stdout, stderr } = geometryDemo(...args);
    assert.equal(status, 1);
    assert.equal(stdout, '');
    assert.equal(stderr.trim(), `Unknown --mark "${args[1] ?? ''}". Use bar, line or table.`);
  }
});

test('selects the requested geometry and defaults to bar', () => {
  for (const mark of [undefined, 'bar', 'line']) {
    const { status, stdout, stderr } = geometryDemo(...(mark ? ['--mark', mark] : []));
    assert.equal(status, 0, stderr);
    assert.equal(stderr, '');
    assert.deepEqual(
      [...stdout.matchAll(/"mark": "(\w+)"/g)].map((match) => match[1]),
      Array(3).fill(mark ?? 'bar'),
    );
  }
});
