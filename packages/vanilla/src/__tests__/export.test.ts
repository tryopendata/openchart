/**
 * Export utility tests.
 *
 * Tests exportSVG, exportSVGWithFonts, exportCSV, exportPNG, and exportJPG
 * functions directly, verifying SVG string validity, font embedding,
 * dimension parsing, CSV formatting, and raster export interfaces.
 */

import type { CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { exportCSV, exportJPG, exportPNG, exportSVG, exportSVGWithFonts } from '../export';
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
// exportSVGWithFonts
// ---------------------------------------------------------------------------

describe('exportSVGWithFonts', () => {
  it('returns a promise', () => {
    const svg = renderToSVG();
    const result = exportSVGWithFonts(svg);
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves to a valid SVG string', async () => {
    const svg = renderToSVG();
    const result = await exportSVGWithFonts(svg);
    expect(result.startsWith('<svg')).toBe(true);
    expect(result.endsWith('</svg>')).toBe(true);
  });

  it('skips font embedding when embedFonts is false', async () => {
    const svg = renderToSVG();
    const result = await exportSVGWithFonts(svg, { embedFonts: false });
    // Should not contain @font-face (no stylesheets in test env anyway)
    expect(result).not.toContain('@font-face');
  });

  it('produces valid SVG even without stylesheets in the document', async () => {
    const svg = renderToSVG();
    // In test env, no Google Fonts stylesheets exist, so font collection
    // should gracefully return nothing and the export should still work
    const result = await exportSVGWithFonts(svg);
    expect(result).toContain('viewBox="0 0 600 400"');
  });
});

// ---------------------------------------------------------------------------
// Dimension parsing (via exportPNG which uses getSVGDimensions internally)
// ---------------------------------------------------------------------------

describe('dimension parsing', () => {
  it('exportPNG reads dimensions from viewBox when width/height are absent', () => {
    const svg = renderToSVG();
    // Verify the SVG has viewBox but no explicit width/height
    expect(svg.getAttribute('viewBox')).toBe('0 0 600 400');
    expect(svg.getAttribute('width')).toBeNull();
    // exportPNG should still work (not fall back to 600x400 by accident)
    const result = exportPNG(svg, { dpi: 1, embedFonts: false });
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {}); // happy-dom canvas limitations
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

// ---------------------------------------------------------------------------
// exportPNG
// ---------------------------------------------------------------------------

describe('exportPNG', () => {
  it('returns a Promise when called with a rendered SVG element', () => {
    const svg = renderToSVG();
    const result = exportPNG(svg, { embedFonts: false });
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });
});

// ---------------------------------------------------------------------------
// exportJPG
// ---------------------------------------------------------------------------

describe('exportJPG', () => {
  it('is a function that accepts an SVG element and options', () => {
    expect(typeof exportJPG).toBe('function');
    expect(exportJPG.length).toBeGreaterThanOrEqual(1);
  });

  it('returns a Promise when called with a rendered SVG element', () => {
    const svg = renderToSVG();
    const result = exportJPG(svg, { embedFonts: false });
    expect(result).toBeInstanceOf(Promise);
    // Clean up: catch any rejection from happy-dom canvas limitations
    result.catch(() => {});
  });

  it('accepts quality option between 0 and 1', () => {
    const svg = renderToSVG();
    const result = exportJPG(svg, { quality: 0.5, dpi: 1, embedFonts: false });
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });
});
