import { expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { migrateSpecV8 } from '../../migration/v8';
import { validateSpec } from '../validate';

const base = {
  mark: 'point',
  data: [{ x: 1, y: 2 }],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};
it('rejects retired breakpoint annotations even when another breakpoint is active', () => {
  const spec = {
    ...base,
    overrides: { compact: { annotations: [{ type: 'rule', y: 2 }], animation: 'legacy' } },
  };
  expect(validateSpec(spec).errors.map((error) => error.path)).toContain(
    'overrides.compact.annotations[0].type',
  );
  expect(() => compileChart(spec, { width: 800, height: 400 })).toThrow(/removed in v9/);
  const migrated = migrateSpecV8(spec);
  expect(migrated.spec.overrides.compact.annotations[0].type).toBe('refline');
  expect(migrated.spec.overrides.compact.animation).toBe(true);
  expect(migrated.repairs.map((repair) => repair.path)).toContain(
    '/overrides/compact/annotations/0/type',
  );
  for (const width of [390, 800])
    expect(() => compileChart(migrated.spec, { width, height: 400 })).not.toThrow();
  expect(migrateSpecV8(migrated.spec).repairs).toEqual([]);
});
it.each([
  { darkMode: 'off' },
  { labels: { offsets: {} } },
  { animation: 'legacy' },
  { mark: { type: 'point', render: 'canvas' } },
  { annotations: [{ type: 'rule', y: 2 }] },
  { theme: { chrome: { title: '#000000' } } },
  ...['radius', 'shape', 'href', 'order'].map((key) => ({
    encoding: { ...base.encoding, [key]: { field: 'x' } },
  })),
])('rejects retired forms and accepts their migrated result: %j', (patch) => {
  const spec = { ...base, ...patch };
  expect(validateSpec(spec).valid).toBe(false);
  expect(() => compileChart(spec, { width: 600, height: 400 })).toThrow(/removed in v9/);
  expect(() => compileChart(migrateSpecV8(spec).spec, { width: 600, height: 400 })).not.toThrow();
});
