/**
 * Behavior tests for the published JSON Schema files.
 *
 * These validate the SHIPPED artifacts (`packages/core/schema/*.json`) against
 * ajv, the same draft-07 validator an LLM tool-use harness would use. They
 * prove three properties the plan requires:
 *
 *   1. Every one of the 16 mark types has a minimal valid spec the schema
 *      accepts (guards against a future mark being added to the types but not
 *      reflected in the generated schema).
 *   2. Hallucinated fields (unknown top-level keys, unknown marks, unknown
 *      encoding channels) are rejected — the mechanic that kills empty-chart
 *      generation failures.
 *   3. Representative realistic specs across chart and table validate.
 *
 * The per-mark specs are built from `MARK_ENCODING_RULES`, the same source the
 * engine validates against, so the coverage tracks the real required-channel
 * matrix rather than a hand-maintained copy.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import { describe, expect, it } from 'vitest';
import { MARK_ENCODING_RULES } from '../../types/encoding';
import { MARK_TYPES } from '../../types/spec';

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'schema');

function loadValidator(filename: string): ValidateFunction {
  const schema = JSON.parse(readFileSync(join(schemaDir, filename), 'utf8'));
  // strict:false — the generated schema uses draft-07 with union types that
  // ajv's strict mode flags; allowUnionTypes matches the tool-use posture.
  const ajv = new Ajv({ strict: false, allowUnionTypes: true });
  return ajv.compile(schema);
}

const validateChart = loadValidator('chart.schema.json');
const validateViz = loadValidator('vizspec.schema.json');
const validateTable = loadValidator('table.schema.json');

/** A data row carrying one column of each field type. */
const sampleData = [
  { cat: 'A', amount: 10, when: '2020-01-01' },
  { cat: 'B', amount: 20, when: '2021-01-01' },
];

/** Pick a field of an allowed type for a required channel. */
function fieldForTypes(allowedTypes: string[]): { field: string; type: string } {
  if (allowedTypes.includes('temporal')) return { field: 'when', type: 'temporal' };
  if (allowedTypes.includes('quantitative')) return { field: 'amount', type: 'quantitative' };
  if (allowedTypes.includes('nominal')) return { field: 'cat', type: 'nominal' };
  if (allowedTypes.includes('ordinal')) return { field: 'cat', type: 'ordinal' };
  return { field: 'cat', type: 'nominal' };
}

/**
 * Build a minimal spec the schema should accept for a given mark, from its
 * required channels in MARK_ENCODING_RULES.
 */
function minimalSpecForMark(mark: string): Record<string, unknown> {
  const rules = MARK_ENCODING_RULES[mark as keyof typeof MARK_ENCODING_RULES] ?? {};
  const encoding: Record<string, unknown> = {};
  for (const [channel, rule] of Object.entries(rules)) {
    if (rule?.required) {
      const types = rule.allowedTypes.length ? rule.allowedTypes : ['quantitative'];
      encoding[channel] = fieldForTypes(types);
    }
  }
  // Ensure at least one positional channel so the spec is meaningful.
  if (encoding.x === undefined && encoding.y === undefined) {
    const yTypes = rules.y?.allowedTypes?.length ? rules.y.allowedTypes : ['quantitative'];
    encoding.y = fieldForTypes(yTypes);
  }
  return { mark, data: sampleData, encoding };
}

describe('chart.schema.json', () => {
  it('has a schema definition for exactly the 16 declared mark types', () => {
    // Every MARK_TYPES entry must produce a spec the schema accepts.
    for (const mark of MARK_TYPES) {
      const spec = minimalSpecForMark(mark);
      const valid = validateChart(spec);
      expect(valid, `mark "${mark}" should validate: ${JSON.stringify(validateChart.errors)}`).toBe(
        true,
      );
    }
  });

  it('rejects an unknown mark type', () => {
    const spec = {
      mark: 'notarealmark',
      data: sampleData,
      encoding: { y: fieldForTypes(['quantitative']) },
    };
    expect(validateChart(spec)).toBe(false);
  });

  it('rejects a hallucinated top-level field', () => {
    const spec = {
      mark: 'bar',
      data: sampleData,
      encoding: { y: { field: 'amount', type: 'quantitative' } },
      totallyMadeUpField: 42,
    };
    expect(validateChart(spec)).toBe(false);
  });

  it('rejects a hallucinated encoding channel', () => {
    const spec = {
      mark: 'bar',
      data: sampleData,
      encoding: { notAChannel: { field: 'amount', type: 'quantitative' } },
    };
    expect(validateChart(spec)).toBe(false);
  });

  it('accepts a realistic bar chart with chrome and a color legend', () => {
    const spec = {
      mark: 'bar',
      data: [
        { language: 'Python', popularity: 29 },
        { language: 'JavaScript', popularity: 24 },
      ],
      encoding: {
        x: { field: 'popularity', type: 'quantitative' },
        y: { field: 'language', type: 'nominal' },
        color: { field: 'popularity', type: 'quantitative' },
      },
      chrome: { title: 'Python leads', source: 'Source: survey' },
    };
    expect(validateChart(spec), JSON.stringify(validateChart.errors)).toBe(true);
  });
});

describe('vizspec.schema.json', () => {
  it('accepts a chart spec (mark-discriminated union member)', () => {
    expect(validateViz(minimalSpecForMark('line'))).toBe(true);
  });

  it('accepts a table spec (type-discriminated union member)', () => {
    const spec = {
      type: 'table',
      data: sampleData,
      columns: [{ key: 'cat' }, { key: 'amount' }],
    };
    expect(validateViz(spec), JSON.stringify(validateViz.errors)).toBe(true);
  });

  it('rejects a spec that is neither a chart nor any known type', () => {
    expect(validateViz({ nonsense: true })).toBe(false);
  });

  it('accepts a graph spec exercising every Phase-1 motion/api field', () => {
    const spec = {
      type: 'graph',
      nodes: [
        { id: 'a', group: 'x', weight: 3 },
        { id: 'b', group: 'y', weight: 1 },
      ],
      edges: [{ source: 'a', target: 'b', kind: 'ref' }],
      encoding: {
        nodeColor: { field: 'group', type: 'nominal', sort: 'ascending', highlight: ['x'] },
        nodeSize: {
          field: 'weight',
          type: 'quantitative',
          scale: { type: 'linear', range: [3, 14] },
        },
        nodeOpacity: { field: 'weight', type: 'quantitative' },
        edgeColor: { field: 'kind', type: 'nominal', sort: ['ref'] },
        edgeStyle: { field: 'kind', type: 'nominal' },
      },
      layout: { type: 'force', seed: 7, energy: 'energetic', settle: 'thorough', warmup: 100 },
      animation: { enter: { duration: 600 }, camera: { ease: 'smooth' }, hover: false },
      interaction: {
        hover: { mode: 'category', dimOpacity: 0.2 },
        select: { flyTo: true },
        cursorRepulsion: { radius: 80, strength: 30 },
        springyDrag: true,
      },
      legend: { interactive: true, counts: true },
    };
    expect(validateViz(spec), JSON.stringify(validateViz.errors)).toBe(true);
  });

  it('rejects an unknown energy preset on a graph layout', () => {
    const spec = {
      type: 'graph',
      nodes: [{ id: 'a' }],
      edges: [],
      layout: { type: 'force', energy: 'nuclear' },
    };
    expect(validateViz(spec)).toBe(false);
  });
});

describe('table.schema.json', () => {
  it('accepts a table with formatted columns', () => {
    const spec = {
      type: 'table',
      data: sampleData,
      columns: [
        { key: 'cat', label: 'Category' },
        { key: 'amount', format: '.0f', align: 'right' },
      ],
      search: true,
    };
    expect(validateTable(spec), JSON.stringify(validateTable.errors)).toBe(true);
  });

  it('rejects a hallucinated top-level field on a table', () => {
    const spec = {
      type: 'table',
      data: sampleData,
      columns: [{ key: 'cat' }],
      madeUp: true,
    };
    expect(validateTable(spec)).toBe(false);
  });
});
