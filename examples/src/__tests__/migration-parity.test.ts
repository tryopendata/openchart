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

describe('authored example v8 migration compatibility', () => {
  it('discovers examples across the gallery and testing stories', () => {
    expect(fixtures.length).toBeGreaterThan(100);
  });
  for (const { name, spec } of fixtures) {
    it(name, () => {
      const before = JSON.stringify(spec);
      const { spec: migrated } = migrateSpecV8(spec);
      expect(migrateSpecV8(migrated)).toEqual({ spec: migrated, repairs: [] });
      expect(JSON.stringify(spec)).toBe(before);
      for (const width of [390, 1280]) {
        // v9 deliberately retunes placement. Migration preserves authored styles,
        // not pixel geometry; every collected legacy example must still compile.
        const result = compile(migrated, width);
        expect(result).toBeDefined();
        expect(JSON.stringify(result)).toBe(JSON.stringify(compile(migrated, width)));
      }
    });
  }
});
