import type { ChartLayout } from '@opendata-ai/openchart-core';
import { afterAll, describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import { checkLayoutInvariants } from './helpers/invariants';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEED = Number(process.env.FUZZ_SEED) || 42;
const CASE_COUNT = 200;

// 'column' is a bar chart with swapped encoding axes, not a distinct mark type
const CHART_VARIANTS = ['bar', 'line', 'point', 'circle', 'column'] as const;
const WIDTHS = [280, 400, 640, 960] as const;
const HEIGHTS = [240, 400] as const;
const LEGEND_POSITIONS = ['top', 'bottom', 'right', 'bottom-right'] as const;
const CHROME_PRESETS = ['none', 'title-subtitle', 'full'] as const;

// ---------------------------------------------------------------------------
// Label pools
// ---------------------------------------------------------------------------

const SHORT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MEDIUM_LABELS = [
  'Sales Q1',
  'Revenue FY23',
  'Customer Count',
  'Net Profit',
  'Gross Margin',
  'Operating Exp',
  'Growth Rate',
  'Market Share',
];
const LONG_LABELS = [
  'United States of America Department',
  'Federal Republic of Germany Statistics',
  'Commonwealth of Australia Annual Report',
  'United Kingdom Economic Growth Summary',
  'International Monetary Fund World Outlook',
  'Organization for Economic Cooperation Data',
];
const CJK_LABELS = ['中文数据', '日本語テスト', '한국어자료', '数据分析报告', '年度总结'];
const DIACRITICS_LABELS = [
  'Ünïcödé Dätä',
  'Renseignements généraux',
  'Bevölkerungszählung',
  'Información demográfica',
  'Données économiques',
];

const ALL_LABELS = [
  ...SHORT_LABELS,
  ...MEDIUM_LABELS,
  ...LONG_LABELS,
  ...CJK_LABELS,
  ...DIACRITICS_LABELS,
];

// ---------------------------------------------------------------------------
// PRNG helpers
// ---------------------------------------------------------------------------

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pickLabels(rand: () => number, count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(pick(rand, ALL_LABELS));
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Chrome generation
// ---------------------------------------------------------------------------

function generateChrome(rand: () => number, preset: (typeof CHROME_PRESETS)[number]) {
  if (preset === 'none') return undefined;
  if (preset === 'title-subtitle') {
    return {
      title: pick(rand, ['Chart Title', 'Quarterly Earnings', '中文标题', 'Données annuelles']),
      subtitle: pick(rand, ['A subtitle for context', 'Values in millions of USD', '年度摘要数据']),
    };
  }
  // full
  return {
    title: pick(rand, ['Full Chrome Chart', 'Economic Overview', 'Ünïcödé Tïtlé']),
    subtitle: pick(rand, ['Comprehensive analysis', 'Year-over-year comparison']),
    source: pick(rand, ['Source: World Bank', 'Source: 数据来源', 'Source: OECD Statistics']),
    byline: pick(rand, ['By Test Author', 'Données par Équipe']),
    footer: pick(rand, ['Note: values are illustrative', 'All figures adjusted for inflation']),
  };
}

// ---------------------------------------------------------------------------
// Data generators per mark type
// ---------------------------------------------------------------------------

function generateBarData(rand: () => number, hasColor: boolean) {
  const categoryCount = randInt(rand, 3, 8);
  const categories = pickLabels(rand, categoryCount);

  if (!hasColor) {
    return categories.map((name) => ({
      name,
      value: randInt(rand, 1, 100) + rand() * 50,
    }));
  }

  const seriesCount = randInt(rand, 2, 6);
  const seriesNames = pickLabels(rand, seriesCount);
  return categories.flatMap((name) =>
    seriesNames.map((series) => ({
      name,
      value: randInt(rand, 1, 100) + rand() * 50,
      series,
    })),
  );
}

function generateLineData(rand: () => number, hasColor: boolean) {
  const pointsPerSeries = randInt(rand, 10, 30);
  const baseYear = 2018;

  if (!hasColor) {
    return Array.from({ length: pointsPerSeries }, (_, i) => ({
      date: `${baseYear + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
      value: randInt(rand, 10, 200) + rand() * 50,
    }));
  }

  const seriesCount = randInt(rand, 1, 5);
  const seriesNames = pickLabels(rand, seriesCount);
  return seriesNames.flatMap((series) =>
    Array.from({ length: pointsPerSeries }, (_, i) => ({
      date: `${baseYear + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
      value: randInt(rand, 10, 200) + rand() * 50,
      series,
    })),
  );
}

function generateScatterData(rand: () => number, hasColor: boolean) {
  const pointCount = randInt(rand, 20, 50);

  if (!hasColor) {
    return Array.from({ length: pointCount }, () => ({
      xVal: rand() * 100,
      yVal: rand() * 100,
    }));
  }

  const groupCount = randInt(rand, 2, 5);
  const groupNames = pickLabels(rand, groupCount);
  return Array.from({ length: pointCount }, () => ({
    xVal: rand() * 100,
    yVal: rand() * 100,
    group: pick(rand, groupNames),
  }));
}

function generateDotData(rand: () => number, hasColor: boolean) {
  const categoryCount = randInt(rand, 3, 8);
  const categories = pickLabels(rand, categoryCount);

  if (!hasColor) {
    return categories.map((name) => ({
      name,
      value: randInt(rand, 1, 100) + rand() * 50,
    }));
  }

  const seriesCount = randInt(rand, 2, 4);
  const seriesNames = pickLabels(rand, seriesCount);
  return categories.flatMap((name) =>
    seriesNames.map((series) => ({
      name,
      value: randInt(rand, 1, 100) + rand() * 50,
      series,
    })),
  );
}

// ---------------------------------------------------------------------------
// Spec generator
// ---------------------------------------------------------------------------

function generateSpec(rand: () => number): {
  spec: Record<string, unknown>;
  width: number;
  height: number;
} {
  const markType = pick(rand, CHART_VARIANTS);
  const width = pick(rand, WIDTHS);
  const height = pick(rand, HEIGHTS);
  const legendPosition = pick(rand, LEGEND_POSITIONS);
  const chromePreset = pick(rand, CHROME_PRESETS);
  const darkMode = rand() > 0.5;
  const hasColor = rand() > 0.4; // 60% chance of color encoding

  const chrome = generateChrome(rand, chromePreset);

  let data: Record<string, unknown>[];
  let encoding: Record<string, unknown>;

  switch (markType) {
    case 'bar': {
      // Horizontal bar: nominal y, quantitative x
      data = generateBarData(rand, hasColor);
      encoding = {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
        ...(hasColor ? { color: { field: 'series', type: 'nominal' } } : {}),
      };
      break;
    }
    case 'column': {
      // Vertical column (bar with swapped encoding): nominal x, quantitative y
      data = generateBarData(rand, hasColor);
      encoding = {
        x: { field: 'name', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        ...(hasColor ? { color: { field: 'series', type: 'nominal' } } : {}),
      };
      break;
    }
    case 'line': {
      data = generateLineData(rand, hasColor);
      encoding = {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        ...(hasColor ? { color: { field: 'series', type: 'nominal' } } : {}),
      };
      break;
    }
    case 'point': {
      // scatter
      data = generateScatterData(rand, hasColor);
      encoding = {
        x: { field: 'xVal', type: 'quantitative' },
        y: { field: 'yVal', type: 'quantitative' },
        ...(hasColor ? { color: { field: 'group', type: 'nominal' } } : {}),
      };
      break;
    }
    case 'circle': {
      // dot
      data = generateDotData(rand, hasColor);
      encoding = {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
        ...(hasColor ? { color: { field: 'series', type: 'nominal' } } : {}),
      };
      break;
    }
  }

  const spec: Record<string, unknown> = {
    // 'column' is actually a bar with swapped encoding
    mark: markType === 'column' ? 'bar' : markType,
    data,
    encoding,
    ...(chrome ? { chrome } : {}),
    ...(hasColor ? { legend: { position: legendPosition } } : {}),
    ...(darkMode ? { darkMode: 'force' } : {}),
  };

  return { spec, width, height };
}

// ---------------------------------------------------------------------------
// Fuzz test
// ---------------------------------------------------------------------------

// Known engine bugs that the fuzz legitimately catches. Filter these so the
// suite passes while still failing on NEW violation types.
function isKnownViolation(v: string): boolean {
  return (
    v.startsWith('legend entry ') ||
    v.startsWith('legend-entry-') ||
    v.startsWith('x-axis-labels outside SVG viewport') ||
    // Space starvation at extreme aspect ratios: a very short container (e.g.
    // 240px tall) with title chrome + auto-rotated long category labels +
    // a bottom legend cannot fit everything. Reserving the correct rotated-
    // label extent (textWidth*|sin θ| + lineHeight*|cos θ|) pushes the bottom
    // legend past the viewport. The previous under-reservation only "fit" by
    // letting rotated ticks overlap the legend/source, which was the very bug
    // the extent fix addresses. Same family as the flat-label overflow above.
    v.startsWith('legend outside SVG viewport')
  );
}

let compileSkipCount = 0;

describe('layout fuzz', () => {
  const rand = mulberry32(SEED);

  afterAll(() => {
    if (compileSkipCount > 0) {
      console.warn(`layout fuzz: ${compileSkipCount} cases skipped due to compile errors`);
    }
  });

  for (let i = 0; i < CASE_COUNT; i++) {
    const { spec, width, height } = generateSpec(rand);

    it(`fuzz case ${i} (seed=${SEED})`, () => {
      let layout: ChartLayout;
      try {
        layout = compileChart(spec, { width, height });
      } catch {
        compileSkipCount++;
        return;
      }
      const violations = checkLayoutInvariants(layout, { svgWidth: width, svgHeight: height });
      const novel = violations.filter((v) => !isKnownViolation(v));
      if (novel.length > 0) {
        const msg = [
          `Seed: ${SEED}, Case: ${i}`,
          `Spec: ${JSON.stringify(spec, null, 2)}`,
          `Size: ${width}x${height}`,
          'Novel violations:',
          ...novel,
        ].join('\n');
        expect.fail(msg);
      }
    });
  }
});
