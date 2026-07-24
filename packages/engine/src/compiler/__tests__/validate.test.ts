import { describe, expect, it } from 'vitest';
import { validateSpec } from '../validate';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const validLineData = [
  { date: '2020-01-01', value: 10, country: 'US' },
  { date: '2021-01-01', value: 20, country: 'US' },
  { date: '2022-01-01', value: 30, country: 'UK' },
];

const validLineSpec = {
  mark: 'line',
  data: validLineData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: { title: 'GDP Growth' },
};

const validBarSpec = {
  mark: 'bar',
  data: [
    { category: 'A', count: 10 },
    { category: 'B', count: 20 },
  ],
  encoding: {
    x: { field: 'count', type: 'quantitative' },
    y: { field: 'category', type: 'nominal' },
  },
};

const validArcSpec = {
  mark: 'arc',
  data: [
    { label: 'Apples', amount: 30 },
    { label: 'Oranges', amount: 50 },
    { label: 'Bananas', amount: 20 },
  ],
  encoding: {
    y: { field: 'amount', type: 'quantitative' },
    color: { field: 'label', type: 'nominal' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateSpec', () => {
  describe('basic shape checks', () => {
    it('rejects null with INVALID_TYPE code', () => {
      const result = validateSpec(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('non-null object');
      expect(result.errors[0].code).toBe('INVALID_TYPE');
      expect(result.errors[0].suggestion).toBeDefined();
    });

    it('rejects arrays', () => {
      const result = validateSpec([1, 2, 3]);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('rejects strings', () => {
      const result = validateSpec('hello');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('rejects objects without mark or type with MISSING_FIELD code', () => {
      const result = validateSpec({ data: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_FIELD');
      expect(result.errors[0].suggestion).toContain('bar');
    });

    it('rejects invalid mark values with INVALID_VALUE code', () => {
      const result = validateSpec({ mark: 'waterfall' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('"waterfall" is not a valid mark type');
      expect(result.errors[0].code).toBe('INVALID_VALUE');
      expect(result.errors[0].suggestion).toContain('line');
    });
  });

  describe('chart specs', () => {
    it('accepts a valid line spec', () => {
      const result = validateSpec(validLineSpec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalized).not.toBeNull();
    });

    it('accepts a valid bar spec', () => {
      const result = validateSpec(validBarSpec);
      expect(result.valid).toBe(true);
    });

    it('accepts a valid arc spec', () => {
      const result = validateSpec(validArcSpec);
      expect(result.valid).toBe(true);
    });

    it('rejects empty data with EMPTY_DATA code and suggestion', () => {
      const result = validateSpec({ ...validLineSpec, data: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('non-empty array');
      expect(result.errors[0].code).toBe('EMPTY_DATA');
      expect(result.errors[0].suggestion).toContain('Add at least one data row');
    });

    it('rejects non-array data with INVALID_TYPE code', () => {
      const result = validateSpec({ ...validLineSpec, data: 'not an array' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must be an array');
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('rejects missing encoding with MISSING_FIELD code and channel suggestion', () => {
      const result = validateSpec({
        mark: 'line',
        data: validLineData,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('requires an "encoding" object');
      expect(result.errors[0].code).toBe('MISSING_FIELD');
      // Should suggest the required channels for this chart type
      expect(result.errors[0].suggestion).toContain('encoding');
    });

    it('rejects missing required channel with MISSING_FIELD code', () => {
      const result = validateSpec({
        mark: 'line',
        data: validLineData,
        encoding: {
          x: { field: 'date', type: 'temporal' },
          // Missing y, which is required for line charts
        },
      });
      expect(result.valid).toBe(false);
      const yError = result.errors.find((e) => e.message.includes('encoding.y'));
      expect(yError).toBeDefined();
      expect(yError!.code).toBe('MISSING_FIELD');
      expect(yError!.suggestion).toBeDefined();
      // Suggestion should mention available data columns
      expect(yError!.suggestion).toContain('date');
    });

    it('rejects field referencing non-existent column with DATA_FIELD_MISSING code', () => {
      const result = validateSpec({
        mark: 'line',
        data: validLineData,
        encoding: {
          x: { field: 'nonexistent', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const fieldError = result.errors.find((e) =>
        e.message.includes('"nonexistent" does not exist'),
      );
      expect(fieldError).toBeDefined();
      expect(fieldError!.code).toBe('DATA_FIELD_MISSING');
      expect(fieldError!.suggestion).toContain('date');
      expect(fieldError!.suggestion).toContain('value');
      expect(fieldError!.suggestion).toContain('country');
    });

    it('rejects invalid field type with INVALID_VALUE code', () => {
      const result = validateSpec({
        mark: 'line',
        data: validLineData,
        encoding: {
          x: { field: 'date', type: 'bogus' },
          y: { field: 'value', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const typeError = result.errors.find((e) => e.message.includes('"bogus" is not valid'));
      expect(typeError).toBeDefined();
      expect(typeError!.code).toBe('INVALID_VALUE');
      expect(typeError!.suggestion).toContain('quantitative');
      expect(typeError!.suggestion).toContain('temporal');
    });

    it('rejects disallowed type for channel with ENCODING_MISMATCH code', () => {
      const result = validateSpec({
        mark: 'line',
        data: validLineData,
        encoding: {
          x: { field: 'date', type: 'quantitative' },
          y: { field: 'value', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const mismatchError = result.errors.find((e) => e.message.includes('does not accept type'));
      expect(mismatchError).toBeDefined();
      expect(mismatchError!.code).toBe('ENCODING_MISMATCH');
      expect(mismatchError!.suggestion).toContain('Change');
    });

    it('catches temporal field with non-date values with ENCODING_MISMATCH', () => {
      const result = validateSpec({
        mark: 'line',
        data: [
          { x: 'not-a-date', y: 10 },
          { x: 'also-not-a-date', y: 20 },
        ],
        encoding: {
          x: { field: 'x', type: 'temporal' },
          y: { field: 'y', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const dateError = result.errors.find((e) => e.message.includes('non-date values'));
      expect(dateError).toBeDefined();
      expect(dateError!.code).toBe('ENCODING_MISMATCH');
      expect(dateError!.suggestion).toContain('nominal');
    });

    it('catches quantitative field with non-numeric values with ENCODING_MISMATCH', () => {
      const result = validateSpec({
        mark: 'point',
        data: [
          { x: 'hello', y: 10 },
          { x: 'world', y: 20 },
        ],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const numError = result.errors.find((e) => e.message.includes('non-numeric values'));
      expect(numError).toBeDefined();
      expect(numError!.code).toBe('ENCODING_MISMATCH');
      expect(numError!.suggestion).toContain('nominal');
    });

    it('rejects invalid darkMode with INVALID_VALUE code', () => {
      const result = validateSpec({
        ...validLineSpec,
        darkMode: 'maybe',
      });
      expect(result.valid).toBe(false);
      const dmError = result.errors.find((e) => e.message.includes('darkMode'));
      expect(dmError).toBeDefined();
      expect(dmError!.code).toBe('INVALID_VALUE');
      expect(dmError!.suggestion).toContain('auto');
    });

    it('rejects missing encoding channel field with MISSING_FIELD code', () => {
      const result = validateSpec({
        mark: 'bar',
        data: [{ a: 1, b: 2 }],
        encoding: {
          x: { type: 'quantitative' },
          y: { field: 'a', type: 'nominal' },
        },
      });
      expect(result.valid).toBe(false);
      const fieldError = result.errors.find((e) =>
        e.message.includes('must have a "field" string'),
      );
      expect(fieldError).toBeDefined();
      expect(fieldError!.code).toBe('MISSING_FIELD');
      expect(fieldError!.suggestion).toContain('a');
    });

    it('accepts tooltip as an array of valid encoding channels', () => {
      const result = validateSpec({
        mark: 'bar',
        data: [{ a: 1, b: 2, c: 3 }],
        encoding: {
          x: { field: 'a', type: 'quantitative' },
          y: { field: 'b', type: 'nominal' },
          tooltip: [
            { field: 'a', type: 'quantitative' },
            { field: 'c', type: 'quantitative' },
          ],
        },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects tooltip array element with missing field', () => {
      const result = validateSpec({
        mark: 'bar',
        data: [{ a: 1, b: 2 }],
        encoding: {
          x: { field: 'a', type: 'quantitative' },
          y: { field: 'b', type: 'nominal' },
          tooltip: [{ field: 'a', type: 'quantitative' }, { type: 'quantitative' }],
        },
      });
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.message.includes('tooltip[1]'));
      expect(err).toBeDefined();
      expect(err!.code).toBe('MISSING_FIELD');
      expect(err!.path).toBe('encoding.tooltip[1].field');
    });
  });

  describe('range marks', () => {
    const rangeData = [
      { country: 'Japan', y2000: 81.1, y2024: 87.9 },
      { country: 'USA', y2000: 79.5, y2024: 81.3 },
    ];

    it('accepts a valid horizontal range spec (x + x2, nominal y)', () => {
      const result = validateSpec({
        mark: 'range',
        data: rangeData,
        encoding: {
          y: { field: 'country', type: 'nominal' },
          x: { field: 'y2000', type: 'quantitative' },
          x2: { field: 'y2024' },
        },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a valid vertical range spec (y + y2, nominal x)', () => {
      const result = validateSpec({
        mark: 'range',
        data: [{ month: 'Jan', lo: 27, hi: 39 }],
        encoding: {
          x: { field: 'month', type: 'nominal' },
          y: { field: 'lo', type: 'quantitative' },
          y2: { field: 'hi' },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a horizontal range spec without x2, naming encoding.x2', () => {
      const result = validateSpec({
        mark: 'range',
        data: rangeData,
        encoding: {
          y: { field: 'country', type: 'nominal' },
          x: { field: 'y2000', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.path === 'encoding.x2');
      expect(err).toBeDefined();
      expect(err!.code).toBe('MISSING_FIELD');
      expect(err!.message).toContain('encoding.x2');
      expect(err!.suggestion).toContain('x2: { field:');
    });

    it('rejects a vertical range spec without y2, naming encoding.y2', () => {
      const result = validateSpec({
        mark: 'range',
        data: [{ month: 'Jan', lo: 27, hi: 39 }],
        encoding: {
          x: { field: 'month', type: 'nominal' },
          y: { field: 'lo', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.path === 'encoding.y2');
      expect(err).toBeDefined();
      expect(err!.code).toBe('MISSING_FIELD');
      expect(err!.message).toContain('encoding.y2');
    });

    it('rejects y2 on a horizontal range spec', () => {
      const result = validateSpec({
        mark: 'range',
        data: rangeData,
        encoding: {
          y: { field: 'country', type: 'nominal' },
          x: { field: 'y2000', type: 'quantitative' },
          x2: { field: 'y2024' },
          y2: { field: 'y2024' },
        },
      });
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.path === 'encoding.y2');
      expect(err).toBeDefined();
      expect(err!.code).toBe('INVALID_VALUE');
    });

    it('rejects a range spec without any categorical axis', () => {
      const result = validateSpec({
        mark: 'range',
        data: rangeData,
        encoding: {
          y: { field: 'y2000', type: 'quantitative' },
          x: { field: 'y2024', type: 'quantitative' },
        },
      });
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'ENCODING_MISMATCH');
      expect(err).toBeDefined();
      expect(err!.message).toContain('category axis');
    });

    it('rejects an unknown mark.style value', () => {
      const result = validateSpec({
        mark: { type: 'range', style: 'ribbon' },
        data: rangeData,
        encoding: {
          y: { field: 'country', type: 'nominal' },
          x: { field: 'y2000', type: 'quantitative' },
          x2: { field: 'y2024' },
        },
      });
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.path === 'mark.style');
      expect(err).toBeDefined();
      expect(err!.code).toBe('INVALID_VALUE');
      expect(err!.message).toContain('dumbbell, arrow, bar');
    });
  });

  describe('table specs', () => {
    it('accepts a valid table spec', () => {
      const result = validateSpec({
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'name' }, { key: 'age' }],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects table without data', () => {
      const result = validateSpec({
        type: 'table',
        columns: [{ key: 'name' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('rejects table with empty data with EMPTY_DATA code', () => {
      const result = validateSpec({
        type: 'table',
        data: [],
        columns: [{ key: 'name' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_DATA');
      expect(result.errors[0].suggestion).toBeDefined();
    });

    it('rejects table without columns with MISSING_FIELD code', () => {
      const result = validateSpec({
        type: 'table',
        data: [{ name: 'Alice' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('"columns" array'))).toBe(true);
      expect(result.errors[0].code).toBe('MISSING_FIELD');
      expect(result.errors[0].suggestion).toContain('columns');
    });

    it('rejects table column referencing non-existent field with DATA_FIELD_MISSING', () => {
      const result = validateSpec({
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'nonexistent' }],
      });
      expect(result.valid).toBe(false);
      const colError = result.errors.find((e) =>
        e.message.includes('"nonexistent" does not exist'),
      );
      expect(colError).toBeDefined();
      expect(colError!.code).toBe('DATA_FIELD_MISSING');
      expect(colError!.suggestion).toContain('name');
      expect(colError!.suggestion).toContain('age');
    });
  });

  describe('graph specs', () => {
    it('accepts a valid graph spec', () => {
      const result = validateSpec({
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects graph without nodes with MISSING_FIELD code', () => {
      const result = validateSpec({
        type: 'graph',
        edges: [],
      });
      expect(result.valid).toBe(false);
      const nodeError = result.errors.find((e) => e.message.includes('"nodes"'));
      expect(nodeError).toBeDefined();
      expect(nodeError!.code).toBe('MISSING_FIELD');
      expect(nodeError!.suggestion).toContain('id');
    });

    it('rejects graph with empty nodes with EMPTY_DATA code', () => {
      const result = validateSpec({
        type: 'graph',
        nodes: [],
        edges: [],
      });
      expect(result.valid).toBe(false);
      const emptyError = result.errors.find((e) => e.message.includes('non-empty'));
      expect(emptyError).toBeDefined();
      expect(emptyError!.code).toBe('EMPTY_DATA');
    });

    it('rejects graph without edges with MISSING_FIELD code', () => {
      const result = validateSpec({
        type: 'graph',
        nodes: [{ id: 'a' }],
      });
      expect(result.valid).toBe(false);
      const edgeError = result.errors.find((e) => e.message.includes('"edges"'));
      expect(edgeError).toBeDefined();
      expect(edgeError!.code).toBe('MISSING_FIELD');
      expect(edgeError!.suggestion).toContain('edges');
    });
  });

  describe('error codes and suggestions', () => {
    it('every error has a code', () => {
      // Test several invalid specs and verify all errors have codes
      const results = [
        validateSpec(null),
        validateSpec({ data: [] }),
        validateSpec({ mark: 'waterfall' }),
        validateSpec({ mark: 'line', data: [] }),
        validateSpec({
          mark: 'line',
          data: [{ x: 1 }],
          encoding: { x: { field: 'missing', type: 'quantitative' } },
        }),
      ];

      for (const result of results) {
        for (const error of result.errors) {
          expect(error.code).toBeDefined();
          expect(typeof error.code).toBe('string');
        }
      }
    });

    it('every error has a suggestion', () => {
      const results = [
        validateSpec(null),
        validateSpec({ data: [] }),
        validateSpec({ mark: 'waterfall' }),
        validateSpec({ mark: 'line', data: [] }),
      ];

      for (const result of results) {
        for (const error of result.errors) {
          expect(error.suggestion).toBeDefined();
          expect(typeof error.suggestion).toBe('string');
          expect(error.suggestion!.length).toBeGreaterThan(0);
        }
      }
    });

    it('DATA_FIELD_MISSING suggestion lists available fields', () => {
      const result = validateSpec({
        mark: 'bar',
        data: [{ alpha: 1, beta: 2, gamma: 3 }],
        encoding: {
          x: { field: 'nonexistent', type: 'quantitative' },
          y: { field: 'alpha', type: 'nominal' },
        },
      });

      const fieldError = result.errors.find((e) => e.code === 'DATA_FIELD_MISSING');
      expect(fieldError).toBeDefined();
      expect(fieldError!.suggestion).toContain('alpha');
      expect(fieldError!.suggestion).toContain('beta');
      expect(fieldError!.suggestion).toContain('gamma');
    });
  });

  describe('transform-created fields', () => {
    it('accepts encoding fields produced by a chained bin + aggregate (histogram)', () => {
      const result = validateSpec({
        mark: 'bar',
        data: [{ hours: 3.1 }, { hours: 3.4 }, { hours: 4.0 }],
        transform: [
          { bin: { step: 0.5 }, field: 'hours', as: 'binStart' },
          { aggregate: [{ op: 'count', field: 'hours', as: 'finishers' }], groupby: ['binStart'] },
        ],
        encoding: {
          x: { field: 'binStart', type: 'ordinal' },
          y: { field: 'finishers', type: 'quantitative' },
        },
      });

      expect(result.valid).toBe(true);
      expect(result.errors.find((e) => e.code === 'DATA_FIELD_MISSING')).toBeUndefined();
    });

    it('accepts an encoding field produced by a window transform', () => {
      const result = validateSpec({
        mark: 'bar',
        data: [
          { day: '1', value: 10 },
          { day: '2', value: 20 },
        ],
        transform: [
          { window: [{ op: 'cumsum', field: 'value', as: 'running' }], sort: [{ field: 'day' }] },
        ],
        encoding: {
          x: { field: 'day', type: 'ordinal' },
          y: { field: 'running', type: 'quantitative' },
        },
      });

      expect(result.valid).toBe(true);
      expect(result.errors.find((e) => e.code === 'DATA_FIELD_MISSING')).toBeUndefined();
    });
  });

  describe('row/column facet validation', () => {
    it('validates row channel field and type', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          row: { field: 'nonexistent', type: 'nominal' },
        },
      });
      expect(result.errors.some((e) => e.path === 'encoding.row.field')).toBe(true);
    });

    it('rejects row with invalid type', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          row: { field: 'country', type: 'quantitative' as 'nominal' },
        },
      });
      expect(result.errors.some((e) => e.path === 'encoding.row.type')).toBe(true);
    });

    it('rejects row + facet together', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          row: { field: 'country', type: 'nominal' },
          facet: { field: 'country', type: 'nominal' },
        },
      });
      expect(result.errors.some((e) => e.message.includes('encoding.row and encoding.facet'))).toBe(
        true,
      );
    });

    it('rejects row + column together', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          row: { field: 'country', type: 'nominal' },
          column: { field: 'date', type: 'ordinal' },
        },
      });
      expect(
        result.errors.some((e) => e.message.includes('encoding.row and encoding.column')),
      ).toBe(true);
    });

    it('accepts valid row channel', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          row: { field: 'country', type: 'nominal' },
        },
      });
      expect(result.errors.filter((e) => e.path?.startsWith('encoding.row'))).toHaveLength(0);
    });

    it('rejects column + facet together', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          column: { field: 'country', type: 'nominal' },
          facet: { field: 'country', type: 'nominal' },
        },
      });
      expect(
        result.errors.some((e) => e.message.includes('encoding.column and encoding.facet')),
      ).toBe(true);
    });

    it('accepts valid column channel', () => {
      const result = validateSpec({
        mark: 'bar',
        data: validLineData,
        encoding: {
          x: { field: 'country', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
          column: { field: 'country', type: 'nominal' },
        },
      });
      expect(result.errors.filter((e) => e.path?.startsWith('encoding.column'))).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// animation.update.maxMarks
// ---------------------------------------------------------------------------

describe('animation.update.maxMarks validation', () => {
  const specWith = (update: unknown) => ({
    mark: 'line',
    data: validLineData,
    animation: { update },
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
  });

  const maxMarksErrors = (spec: unknown) =>
    validateSpec(spec).errors.filter((e) => e.path === 'animation.update.maxMarks');

  it('accepts a positive maxMarks', () => {
    const result = validateSpec(specWith({ maxMarks: 5000 }));
    expect(result.valid).toBe(true);
  });

  it.each([[0], [-1], [Number.NaN], ['5000'], [null]])('rejects maxMarks %p', (value) => {
    const errors = maxMarksErrors(specWith({ maxMarks: value }));
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('INVALID_VALUE');
    expect(errors[0].suggestion).toBeTruthy();
  });

  it.each([[0.5], [0.99]])('rejects a fractional maxMarks below 1 (%p)', (value) => {
    // The resolver floors the cap, so 0.5 would become 0, and `0 ?? DEFAULT`
    // keeps 0 -- disabling every update transition instead of raising the cap.
    const errors = maxMarksErrors(specWith({ maxMarks: value }));
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('INVALID_VALUE');
  });

  it('accepts maxMarks of exactly 1', () => {
    expect(maxMarksErrors(specWith({ maxMarks: 1 }))).toHaveLength(0);
  });

  it('does not flag maxMarks on a graph spec (GraphAnimationSpec has no such field)', () => {
    // Graph carries GraphAnimationSpec, and the generated JSON schema rejects
    // maxMarks there outright. Emitting a "must be >= 1" error would imply the
    // field is otherwise legal on a graph, contradicting the schema.
    const graph = {
      type: 'graph',
      data: { nodes: [{ id: 'a' }, { id: 'b' }], links: [{ source: 'a', target: 'b' }] },
      animation: { update: { maxMarks: -5 } },
    };
    expect(maxMarksErrors(graph)).toHaveLength(0);
  });

  it('ignores an absent maxMarks', () => {
    expect(maxMarksErrors(specWith({ duration: 800 }))).toHaveLength(0);
  });

  it('ignores shorthand animation forms', () => {
    expect(maxMarksErrors({ ...specWith(true), animation: true })).toHaveLength(0);
    expect(maxMarksErrors(specWith(true))).toHaveLength(0);
    expect(maxMarksErrors(specWith(false))).toHaveLength(0);
  });
});
