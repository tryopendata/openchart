/**
 * The layout plan and the figure budget build one figure frame (layout/frame.ts),
 * so the plot the plan measures against is the plot the budget places. These
 * specs each carry a reservation that once existed only on the budget side.
 */

import { describe, expect, it } from 'vitest';
import { compileChartInternal } from '../compile/chart';
import type { InternalCompileOptions, LeafContext } from '../compile/internal-options';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const regions = ['North America', 'Western Europe', 'Southeast Asia'];
const series = months.flatMap((month, i) =>
  regions.map((region, r) => ({ month, region, value: 40 + i * 7 + r * 13 })),
);

const lineBase = {
  mark: 'line',
  data: series,
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
  },
  chrome: { title: 'Regional output', subtitle: 'Index, first half of the year' },
};

const SPECS: Record<string, Record<string, unknown>> = {
  'bar value column': {
    mark: 'bar',
    data: [
      { name: 'A long category name', value: -12.34 },
      { name: 'Other', value: 0 },
      { name: 'Third', value: 123.45 },
    ],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'name', type: 'nominal' },
    },
    labels: { placement: 'column', format: ',.2f', suffix: ' million' },
  },
  'outside signed columns': {
    mark: 'bar',
    data: [
      { name: 'Negative', value: -12.34 },
      { name: 'Zero', value: 0 },
      { name: 'Positive', value: 123.45 },
    ],
    encoding: {
      x: { field: 'name', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
    labels: { placement: 'outside', format: ',.2f', suffix: ' million' },
  },
  'value column with axis header': {
    mark: 'bar',
    data: [
      { name: 'Negative', value: -12.34 },
      { name: 'Zero', value: 0 },
      { name: 'Positive', value: 123.45 },
    ],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: {
        field: 'name',
        type: 'nominal',
        axis: {
          title: 'Department with a deliberately long header',
          titleAngle: 0,
          titleAnchor: 'end',
        },
      },
    },
    labels: { placement: 'column', format: ',.2f' },
  },
  'endpoint label column': { ...lineBase, endpointLabels: true },
  'right legend column': { ...lineBase, endpointLabels: false, legend: { position: 'right' } },
  'nominal x beside a right legend': {
    mark: 'bar',
    data: series,
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'value', type: 'quantitative', aggregate: 'sum' },
      color: { field: 'month', type: 'nominal' },
    },
    legend: { position: 'right' },
  },
  'size legend': {
    mark: 'point',
    data: series,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
      size: { field: 'value', type: 'quantitative' },
    },
  },
  'outside reference labels': {
    ...lineBase,
    annotations: [
      { type: 'refline', x: 'Feb', label: 'Policy change', labelPlacement: 'outside' },
      { type: 'refline', x: 'Mar', label: 'Supply shock', labelPlacement: 'outside' },
      { type: 'refline', y: 70, label: 'Target', labelPlacement: 'outside' },
    ],
  },
  'metric bar': {
    ...lineBase,
    metrics: [
      { label: 'Peak', value: '108' },
      { label: 'Change', value: '+35%' },
    ],
  },
  'series summary note band': { ...lineBase, responsive: { labelSummary: true } },
  'y-axis title gutter': {
    ...lineBase,
    encoding: {
      ...lineBase.encoding,
      y: { field: 'value', type: 'quantitative', axis: { title: 'Output index' } },
    },
  },
};

const VIEWPORTS = [
  { width: 340, height: 300 },
  { width: 640, height: 400 },
  { width: 1100, height: 520 },
];

// Cases whose chrome the guardrail strips, so the budget's plot outgrows the plan's.
const STRIPPED = new Set(['metric bar @ 340x300']);

function compileWithLeaf(spec: Record<string, unknown>, options: InternalCompileOptions) {
  const leafContext: LeafContext = {};
  const layout = compileChartInternal(structuredClone(spec), { ...options, leafContext });
  return { plan: leafContext.plan!, budget: leafContext.budget!, layout };
}

describe('figure frame: plan and budget place the same plot', () => {
  for (const [name, spec] of Object.entries(SPECS)) {
    for (const viewport of VIEWPORTS) {
      it(`${name} @ ${viewport.width}x${viewport.height}`, () => {
        const { plan, budget, layout } = compileWithLeaf(spec, viewport);
        // The chrome ladder stepping down is the one sanctioned divergence: the
        // compile then regenerates ticks against the final plot it draws.
        const stripped = STRIPPED.has(`${name} @ ${viewport.width}x${viewport.height}`);
        expect(!!budget.chromeStripped).toBe(stripped);
        if (stripped) {
          expect(layout.area).toEqual(budget.chartArea);
          return;
        }
        expect(plan.plotArea).toEqual(budget.chartArea);
        // The bottom margin was reserved for the x labels computeAxes draws:
        // only band axes rotate, and at the plot width they are drawn on.
        expect(plan.xAxisExtent).toBeCloseTo(layout.axes.x?.extent ?? 0, 1);
      });
    }
  }

  it('picks the x-label angle at the plot the y-axis title gutter leaves', () => {
    // At this width flat labels fit the plot before the title widens the
    // gutter, and not after.
    const spec = {
      mark: 'bar',
      data: [
        { category: 'Information Technology', value: 32.4 },
        { category: 'Health Care Services', value: 13.1 },
        { category: 'Financial Services', value: 12.8 },
        { category: 'Consumer Discretionary', value: 10.5 },
        { category: 'Communication Services', value: 8.9 },
        { category: 'Industrial Manufacturing', value: 8.4 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', axis: { title: 'Weight (%)' } },
      },
      chrome: { title: 'S&P 500 Sector Weights', source: 'Source: S&P Dow Jones Indices' },
    };
    const { plan, layout } = compileWithLeaf(spec, { width: 1380, height: 400 });
    expect(layout.axes.x?.tickAngle).toBe(-45);
    expect(plan.xAxisExtent).toBeCloseTo(layout.axes.x?.extent ?? 0, 1);
  });

  it('picks the x-label angle at the plot inline y labels leave', () => {
    // Inline y tick labels inset the bands computeAxes draws on; at this width
    // flat labels fit the full plot but not the inset one.
    const spec = {
      mark: 'bar',
      data: [
        { category: 'Information Technology', value: 32.4 },
        { category: 'Health Care Services', value: 13.1 },
        { category: 'Financial Services', value: 12.8 },
        { category: 'Consumer Discretionary', value: 10.5 },
        { category: 'Communication Services', value: 8.9 },
        { category: 'Industrial Manufacturing', value: 8.4 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', axis: { tickPosition: 'inline' } },
      },
    };
    for (const width of [1350, 1360, 1370]) {
      const { plan, layout } = compileWithLeaf(spec, { width, height: 400 });
      expect(plan.xAxisExtent).toBeCloseTo(layout.axes.x?.extent ?? 0, 1);
    }
  });

  it('a secondary y-axis reserve narrows the planned plot', () => {
    const viewport = { width: 640, height: 400 };
    const { plan, budget } = compileWithLeaf(SPECS['endpoint label column'], {
      ...viewport,
      rightAxisReserve: 72,
    });
    expect(plan.plotArea).toEqual(budget.chartArea);
  });
});
