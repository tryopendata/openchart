#!/usr/bin/env node

/**
 * Static SVG rendering example.
 *
 * Demonstrates rendering an openchart spec to a standalone SVG file
 * from a plain Node.js script with no DOM globals.
 *
 * Usage:
 *   node examples/static-render.mjs
 *
 * Output:
 *   examples/output.svg
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderStaticSVG } from '@opendata-ai/openchart-vanilla/static';

const spec = {
  mark: 'line',
  data: [
    { year: '2019', revenue: 280, company: 'Apple' },
    { year: '2020', revenue: 274, company: 'Apple' },
    { year: '2021', revenue: 366, company: 'Apple' },
    { year: '2022', revenue: 394, company: 'Apple' },
    { year: '2023', revenue: 383, company: 'Apple' },
    { year: '2019', revenue: 161, company: 'Google' },
    { year: '2020', revenue: 183, company: 'Google' },
    { year: '2021', revenue: 258, company: 'Google' },
    { year: '2022', revenue: 283, company: 'Google' },
    { year: '2023', revenue: 307, company: 'Google' },
  ],
  encoding: {
    x: { field: 'year', type: 'temporal' },
    y: { field: 'revenue', type: 'quantitative', axis: { title: 'Revenue ($B)' } },
    color: { field: 'company', type: 'nominal' },
  },
  chrome: {
    title: 'Big Tech Revenue',
    subtitle: 'Annual revenue in billions, 2019-2023',
    source: 'Company filings',
  },
};

const svg = renderStaticSVG(spec, {
  width: 640,
  height: 420,
  darkMode: 'off',
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, 'output.svg');
writeFileSync(outPath, svg, 'utf-8');

console.log(`Wrote ${svg.length} bytes to ${outPath}`);
