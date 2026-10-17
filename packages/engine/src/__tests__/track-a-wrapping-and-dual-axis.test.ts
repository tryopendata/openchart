import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { estimateTextWidth, footnoteBandHeight } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';
import { migrateSpecV8 } from '../migration/v8';

const noteSpec: ChartSpec = {
  mark: 'line',
  data: [
    { x: 0, y: 1 },
    { x: 1, y: 2 },
  ],
  encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
  chrome: { source: 'Source' },
  annotations: [0, 1].map((x) => ({
    type: 'text',
    id: `note-${x}`,
    x,
    y: x + 1,
    text: 'A long annotation heading that cannot fit inline',
    subtitle:
      'The subtitle must remain readable within the figure, including exceptionallylongunbrokenidentifiers'.repeat(
        2,
      ),
  })),
};

export const secondaryLineSpec: LayerSpec = {
  animation: false,
  legend: { show: false },
  endpointLabels: false,
  resolve: { scale: { y: 'independent' } },
  layer: [
    {
      mark: 'bar',
      data: [
        { x: 'Jan', y: 100 },
        { x: 'Feb', y: 150 },
      ],
      encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
    },
    {
      mark: 'line',
      data: [
        { x: 'Jan', y: 2, s: 'Alpha' },
        { x: 'Feb', y: 5, s: 'Alpha' },
        { x: 'Jan', y: 6, s: 'Beta' },
        { x: 'Feb', y: 4, s: 'Beta' },
      ],
      encoding: {
        x: { field: 'x', type: 'ordinal' },
        y: { field: 'y', type: 'quantitative', axis: { title: 'Right value' } },
        color: { field: 's', type: 'nominal' },
      },
    },
  ],
};

describe('wrapped annotation notes', () => {
  it.each([
    'subtract',
    'grow',
  ] as const)('reserves every wrapped line with %s sizing', (chromeLayout) => {
    const options = { width: 292, height: 500, chromeLayout };
    const layout = compileChart(noteSpec, options);
    const notes = layout.chrome.footnotes!;
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((note) => (note.lines?.length ?? 0) > 1)).toBe(true);
    for (const note of notes) {
      expect(note.lines!.join(' ').replaceAll(' ', '')).toBe(
        `${note.index}. ${note.text}`.replaceAll(' ', ''),
      );
      for (const line of note.lines!)
        expect(
          estimateTextWidth(
            line,
            layout.theme.fonts.sizes.small,
            layout.theme.fonts.weights.normal,
          ),
        ).toBeLessThanOrEqual(options.width - 2 * layout.theme.spacing.padding);
    }
    const baseline = compileChart({ ...noteSpec, annotations: [] }, options);
    const band = footnoteBandHeight(
      notes.reduce((n, note) => n + note.lines!.length, 0),
      layout.theme,
    );
    if (chromeLayout === 'grow') {
      expect(layout.area.height).toBeCloseTo(baseline.area.height);
      expect(layout.dimensions.height - baseline.dimensions.height).toBeCloseTo(band);
    } else {
      expect(layout.dimensions.height).toBe(500);
      expect(baseline.area.height - layout.area.height).toBeCloseTo(band);
    }
  });
});

describe('secondary-axis endpoint migration', () => {
  it.each([
    390, 1280,
  ])('preserves both series and places the column beyond the right axis at %i', (width) => {
    const migrated = migrateSpecV8(secondaryLineSpec);
    expect(migrated.spec.endpointLabels).toEqual({ content: 'label', showMarker: false });
    expect(migrateSpecV8(migrated.spec).repairs).toEqual([]);
    const layout = compileLayer(migrated.spec, { width, height: 450 });
    const endpoint = layout.endpointLabels!;
    expect(endpoint?.entries.map((entry) => entry.seriesKey)).toEqual(['Alpha', 'Beta']);
    expect(endpoint.bounds.x).toBeGreaterThan(layout.axes.y2!.titlePosition!.x + 6);
    expect(endpoint.bounds.x + endpoint.bounds.width).toBeLessThanOrEqual(width);
    const lastTickX = layout.axes.x!.ticks.at(-1)!.position;
    for (const mark of layout.marks) {
      if (mark.type !== 'line') continue;
      expect(mark.points.at(-1)!.x).toBeCloseTo(lastTickX);
      expect(
        endpoint.entries.find((entry) => entry.seriesKey === mark.seriesKey)!.dataY,
      ).toBeCloseTo(mark.points.at(-1)!.y);
    }
  });
});

it('merges both axes without losing formats and resolves cross-axis label collisions', () => {
  const line = secondaryLineSpec.layer[1] as ChartSpec;
  const first: ChartSpec = {
    ...line,
    data: (line.data as Record<string, unknown>[]).map((row) => ({
      ...row,
      s: `${row.s} primary`,
    })),
    encoding: { ...line.encoding, y: { ...line.encoding.y!, format: '.1f' } },
  };
  const spec: LayerSpec = {
    ...secondaryLineSpec,
    endpointLabels: { content: 'label+value', showLeader: true },
    layer: [first, line],
  };
  const layout = compileLayer(spec, { width: 1280, height: 500 });
  const ep = layout.endpointLabels!;
  expect(ep.entries).toHaveLength(4);
  expect(ep.entries.some((entry) => entry.labelLines.join(' ').includes('5.0'))).toBe(true);
  const sorted = [...ep.entries].sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i].labelY - sorted[i - 1].labelY).toBeGreaterThanOrEqual(
      ep.labelStyle.fontSize * 1.25,
    );
  }
  expect(ep.entries.some((entry) => entry.showLeader)).toBe(true);
  for (const mark of layout.marks) {
    if (mark.type !== 'line') continue;
    const entry = ep.entries.find((entry) => entry.seriesKey === mark.seriesKey)!;
    expect(entry.marker!.dataX).toBeCloseTo(mark.dataPoints!.at(-1)!.x);
    expect(entry.marker!.y).toBeCloseTo(mark.dataPoints!.at(-1)!.y);
  }
});

it.each([
  'grow',
  'subtract',
] as const)('keeps wrapped notes inside a dual-axis figure in %s mode', (chromeLayout) => {
  const line = secondaryLineSpec.layer[1] as ChartSpec;
  const spec: LayerSpec = {
    ...secondaryLineSpec,
    layer: [
      {
        ...line,
        chromeLayout,
        chrome: { source: 'Source' },
        annotations: [0, 1, 2].map((index) => ({
          type: 'text',
          x: 'Jan',
          y: 2 + index,
          text: 'This is a long annotation heading that cannot fit inline',
          subtitle:
            'This is the detail that must wrap safely beneath the plot and above the source.',
        })),
      },
      secondaryLineSpec.layer[0],
    ],
    endpointLabels: { content: 'label', showMarker: false },
  };
  const layout = compileLayer(spec, { width: 390, height: 450 });
  const notes = layout.chrome.footnotes!;
  expect(notes.length).toBeGreaterThan(0);
  const noteBand = footnoteBandHeight(
    notes.reduce((n, note) => n + (note.lines?.length ?? 1), 0),
    layout.theme,
  );
  const sourceBottom =
    layout.chrome.bottomAnchorY! +
    noteBand +
    layout.chrome.source!.y +
    layout.chrome.source!.style.fontSize * 1.3;
  expect(sourceBottom).toBeLessThanOrEqual(layout.dimensions.height);
  if (chromeLayout === 'subtract') expect(layout.dimensions.height).toBe(450);
  else expect(layout.dimensions.height).toBeGreaterThan(450);
});

it('keeps a leading endpoint column clear of the left axis title', () => {
  const first = secondaryLineSpec.layer[0] as ChartSpec;
  const spec: LayerSpec = {
    ...secondaryLineSpec,
    endpointLabels: { ends: 'both', content: 'label' },
    layer: [
      {
        ...first,
        encoding: { ...first.encoding, y: { ...first.encoding.y!, axis: { title: 'Left value' } } },
      },
      secondaryLineSpec.layer[1],
    ],
  };
  const layout = compileLayer(spec, { width: 1280, height: 500 });
  const bounds = layout.endpointLabels!.leadingBounds!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThan(layout.axes.y!.titlePosition!.x - 6);
});

it.each([
  false,
  true,
])('keeps a right legend outside the axis and endpoints (bar first: %s)', (barFirst) => {
  const line = secondaryLineSpec.layer[1] as ChartSpec;
  const spec: LayerSpec = {
    ...secondaryLineSpec,
    legend: { show: true, position: 'right' },
    endpointLabels: { content: 'label' },
    layer: barFirst ? [secondaryLineSpec.layer[0], line] : [line, secondaryLineSpec.layer[0]],
  };
  const layout = compileLayer(spec, { width: 640, height: 450 });
  const ep = layout.endpointLabels!.bounds;
  expect(layout.legend.bounds.width).toBeGreaterThan(0);
  expect(layout.legend.bounds.x).toBeGreaterThanOrEqual(ep.x + ep.width + 4);
  expect(layout.legend.bounds.x + layout.legend.bounds.width).toBeLessThanOrEqual(640);
  if ('entryPositions' in layout.legend) {
    expect(layout.legend.entryPositions![0].x).toBeGreaterThanOrEqual(layout.legend.bounds.x);
  }
});

it('reflows all right-legend entries when both axes contribute', () => {
  const line = secondaryLineSpec.layer[1] as ChartSpec;
  const other = {
    ...line,
    data: (line.data as Record<string, unknown>[]).map((row) => ({ ...row, s: `${row.s} other` })),
  } as ChartSpec;
  const layout = compileLayer(
    {
      ...secondaryLineSpec,
      legend: { show: true, position: 'right' },
      endpointLabels: { content: 'label' },
      layer: [line, other],
    },
    { width: 1280, height: 600 },
  );
  const legend = layout.legend;
  expect('entries' in legend).toBe(true);
  if (!('entries' in legend)) return;
  expect(legend.entries).toHaveLength(4);
  expect(legend.entryPositions).toHaveLength(4);
  expect(new Set(legend.entryPositions!.map((entry) => entry.y)).size).toBe(4);
  expect(legend.bounds.x).toBeGreaterThan(
    layout.endpointLabels!.bounds.x + layout.endpointLabels!.bounds.width,
  );
});

it('reserves wrapped notes once beneath a facet grid', () => {
  const spec: ChartSpec = {
    ...noteSpec,
    data: ['North', 'South'].flatMap((region) =>
      (noteSpec.data as Record<string, unknown>[]).map((row) => ({ ...row, region })),
    ),
    encoding: { ...noteSpec.encoding, facet: { field: 'region', type: 'nominal', columns: 2 } },
  };
  const layout = compileChart(spec, { width: 390, height: 650 });
  const notes = layout.chrome.footnotes!;
  expect(notes.length).toBeGreaterThan(0);
  expect(notes.every((note) => (note.lines?.length ?? 0) > 1)).toBe(true);
  expect(new Set(notes.map((note) => note.id)).size).toBe(notes.length);
  const reserve = footnoteBandHeight(
    notes.reduce((sum, note) => sum + note.lines!.length, 0),
    layout.theme,
  );
  const bottom =
    layout.area.y +
    layout.area.height +
    reserve +
    layout.chrome.source!.y +
    layout.chrome.source!.style.fontSize * 1.3;
  expect(bottom).toBeLessThanOrEqual(layout.dimensions.height);
});
