/// <reference types="vite/client" />
import type { VizSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
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
import { migrateSpecV8 } from '../../../packages/engine/src/migration/v8';

const modules = import.meta.glob('../**/*.{stories,layouts}.tsx', { eager: true }) as Record<
  string,
  { __authoredValues: Record<string, unknown> }
>;
const fixtures: Array<{ name: string; spec: VizSpec }> = [];
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
    fixtures.push({ name, spec: value as VizSpec });
    return;
  }
  for (const [key, child] of Object.entries(record)) collect(child, `${name}.${key}`);
}
for (const [file, module] of Object.entries(modules)) collect(module.__authoredValues, file);

function compile(spec: VizSpec, width: number) {
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
}

describe('authored example migration parity', () => {
  it('discovers examples across the gallery and testing stories', () => {
    expect(fixtures.length).toBeGreaterThan(100);
  });
  for (const { name, spec } of fixtures) {
    it(name, () => {
      const { spec: migrated, repairs } = migrateSpecV8(spec);
      expect(migrateSpecV8(migrated)).toEqual({ spec: migrated, repairs: [] });
      // The approved end-of-line rewrite deliberately changes placement.
      if (repairs.some((repair) => repair.reason.includes('end-of-line'))) return;
      for (const width of [390, 1280]) {
        // Layouts contain formatter/scale closures with fresh identities.
        // Compare all serialized geometry, text, colors and layout metadata.
        expect(JSON.stringify(compile(migrated, width))).toBe(JSON.stringify(compile(spec, width)));
      }
    });
  }
});
