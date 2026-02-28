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
  type: 'line',
  data: validLineData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: { title: 'GDP Growth' },
};

const validBarSpec = {
  type: 'bar',
  data: [
    { category: 'A', count: 10 },
    { category: 'B', count: 20 },
  ],
  encoding: {
    x: { field: 'count', type: 'quantitative' },
    y: { field: 'category', type: 'nominal' },
  },
};

const validPieSpec = {
  type: 'pie',
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

    it('rejects objects without type with MISSING_FIELD code', () => {
      const result = validateSpec({ data: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('"type" field');
      expect(result.errors[0].code).toBe('MISSING_FIELD');
      expect(result.errors[0].suggestion).toContain('line');
    });

    it('rejects invalid type values with INVALID_VALUE code', () => {
      const result = validateSpec({ type: 'waterfall' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('"waterfall" is not a valid type');
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

    it('accepts a valid pie spec', () => {
      const result = validateSpec(validPieSpec);
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
        type: 'line',
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
        type: 'line',
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
        type: 'line',
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
        type: 'line',
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
        type: 'line',
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
        type: 'line',
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
        type: 'scatter',
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
        type: 'bar',
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
        validateSpec({ type: 'waterfall' }),
        validateSpec({ type: 'line', data: [] }),
        validateSpec({
          type: 'line',
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
        validateSpec({ type: 'waterfall' }),
        validateSpec({ type: 'line', data: [] }),
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
        type: 'bar',
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
});
