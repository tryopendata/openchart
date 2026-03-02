import { describe, expect, it } from 'vitest';
import { compile } from '../index';
import type { NormalizedChartSpec } from '../types';

describe('compile (validate + normalize pipeline)', () => {
  const validSpec = {
    type: 'line',
    data: [
      { date: '2020-01-01', value: 10 },
      { date: '2021-01-01', value: 20 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: { title: 'Test Chart' },
  };

  it('returns a normalized spec for valid input', () => {
    const result = compile(validSpec);
    expect(result.spec).toBeDefined();
    expect(result.spec.type).toBe('line');
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it('fills in defaults on the normalized spec', () => {
    const result = compile(validSpec);
    const spec = result.spec as NormalizedChartSpec;
    expect(spec.responsive).toBe(true);
    expect(spec.darkMode).toBe('off');
    expect(spec.annotations).toEqual([]);
  });

  it('normalizes chrome strings', () => {
    const result = compile(validSpec);
    const spec = result.spec as NormalizedChartSpec;
    expect(spec.chrome.title).toEqual({ text: 'Test Chart' });
  });

  it('throws on invalid spec', () => {
    expect(() => compile(null)).toThrow('Invalid spec');
    expect(() => compile({})).toThrow('Invalid spec');
    expect(() =>
      compile({
        type: 'line',
        data: [],
        encoding: {},
      }),
    ).toThrow('Invalid spec');
  });

  it('produces warnings for inferred types', () => {
    const spec = {
      type: 'scatter',
      data: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      encoding: {
        x: { field: 'x' },
        y: { field: 'y' },
      },
    };

    const result = compile(spec);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('Inferred'))).toBe(true);
  });

  it('works for table specs', () => {
    const result = compile({
      type: 'table',
      data: [{ name: 'Alice', age: 30 }],
      columns: [{ key: 'name' }],
    });
    expect(result.spec.type).toBe('table');
  });

  it('works for graph specs', () => {
    const result = compile({
      type: 'graph',
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }],
    });
    expect(result.spec.type).toBe('graph');
  });
});
