/**
 * Export utility tests.
 *
 * Tests exportSVG and exportCSV functions directly, verifying SVG string
 * validity and CSV formatting with headers and proper escaping.
 */

import type { CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { exportCSV, exportSVG } from '../export';
import { renderChartSVG } from '../svg-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPILE_OPTS: CompileOptions = { width: 600, height: 400 };

function renderToSVG(spec = lineSpec) {
  const container = createContainer();
  const layout = compileChart(spec, COMPILE_OPTS);
  return renderChartSVG(layout, container);
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// exportSVG
// ---------------------------------------------------------------------------

describe('exportSVG', () => {
  it('returns a string starting with <svg', () => {
    const svg = renderToSVG();
    const result = exportSVG(svg);
    expect(result.startsWith('<svg')).toBe(true);
  });

  it('returned string contains viewBox attribute', () => {
    const svg = renderToSVG();
    const result = exportSVG(svg);
    expect(result).toContain('viewBox="0 0 600 400"');
  });

  it('returned string contains chart chrome text content', () => {
    const svg = renderToSVG(lineSpec);
    const result = exportSVG(svg);
    expect(result).toContain('GDP Growth');
    expect(result).toContain('US vs UK over time');
    expect(result).toContain('World Bank');
  });

  it('returned string contains SVG namespace', () => {
    const svg = renderToSVG();
    const result = exportSVG(svg);
    expect(result).toContain('xmlns');
    expect(result).toContain('http://www.w3.org/2000/svg');
  });

  it('returned string includes mark elements', () => {
    const svg = renderToSVG(barSpec);
    const result = exportSVG(svg);
    // Bar chart should have rect elements
    expect(result).toContain('<rect');
    expect(result).toContain('viz-mark-rect');
  });

  it('returned string is well-formed XML (ends with closing svg tag)', () => {
    const svg = renderToSVG();
    const result = exportSVG(svg);
    expect(result.endsWith('</svg>')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// exportCSV
// ---------------------------------------------------------------------------

describe('exportCSV', () => {
  it('returns empty string for empty data', () => {
    const result = exportCSV([]);
    expect(result).toBe('');
  });

  it('first line contains column headers from data keys', () => {
    const data = [
      { name: 'Alice', age: 30, city: 'Portland' },
      { name: 'Bob', age: 25, city: 'Seattle' },
    ];
    const result = exportCSV(data);
    const firstLine = result.split('\n')[0];
    expect(firstLine).toBe('name,age,city');
  });

  it('data rows follow header line', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = exportCSV(data);
    const lines = result.split('\n');
    expect(lines.length).toBe(3); // 1 header + 2 data rows
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('escapes values containing commas', () => {
    const data = [{ name: 'Doe, John', value: 42 }];
    const result = exportCSV(data);
    const lines = result.split('\n');
    // Comma in value should be wrapped in double quotes
    expect(lines[1]).toBe('"Doe, John",42');
  });

  it('escapes values containing double quotes', () => {
    const data = [{ name: 'Say "hi"', value: 1 }];
    const result = exportCSV(data);
    const lines = result.split('\n');
    // Double quotes should be doubled and the field wrapped in quotes
    expect(lines[1]).toBe('"Say ""hi""",1');
  });

  it('escapes values containing newlines', () => {
    const data = [{ name: 'Line1\nLine2', value: 1 }];
    const result = exportCSV(data);
    // The entire field should be quoted since it contains a newline
    expect(result).toContain('"Line1\nLine2"');
  });

  it('handles undefined and null values as empty strings', () => {
    const data = [{ a: undefined, b: null, c: 'ok' }];
    const result = exportCSV(data);
    const lines = result.split('\n');
    // undefined and null should render as empty
    expect(lines[1]).toBe(',,ok');
  });

  it('uses keys from first row as headers', () => {
    const data = [
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ];
    const result = exportCSV(data);
    expect(result.split('\n')[0]).toBe('x,y,z');
  });
});
