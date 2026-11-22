import { describe, expect, it } from 'vitest';
import {
  type LabelNode,
  placeInsideLabels,
  shouldPlaceLabelsInside,
  spreadColumn,
} from '../label-placement';

// A font that draws every character 7px wide keeps the arithmetic readable.
const metrics = {
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 16,
  measureText: (text: string, fontSize: number) => ({ width: text.length * 7, height: fontSize }),
};

const frame = { left: 0, right: 360, top: 0, bottom: 400 };

const node = (id: string, depth: number, x0: number, y0: number, y1: number): LabelNode => ({
  id,
  depth,
  x0,
  x1: x0 + 12,
  y0,
  y1,
  name: id,
});

describe('shouldPlaceLabelsInside', () => {
  it('moves labels inside once the gutters leave the flow under half the plot', () => {
    expect(shouldPlaceLabelsInside('auto', 320, { left: 90, right: 80 })).toBe(true);
  });

  it('keeps labels outside while the flow holds half the plot', () => {
    expect(shouldPlaceLabelsInside('auto', 320, { left: 80, right: 80 })).toBe(false);
  });

  it('never moves labels when the author chose a side', () => {
    expect(shouldPlaceLabelsInside('right', 320, { left: 0, right: 200 })).toBe(false);
    expect(shouldPlaceLabelsInside('left', 320, { left: 200, right: 0 })).toBe(false);
  });
});

describe('spreadColumn', () => {
  it('leaves blocks that do not touch where they are', () => {
    const centres = spreadColumn(
      [
        { id: 'a', centre: 50, height: 20 },
        { id: 'b', centre: 200, height: 20 },
      ],
      0,
      400,
    );
    expect(centres.get('a')).toBe(50);
    expect(centres.get('b')).toBe(200);
  });

  it('pushes an overlapping block down below its neighbour, in order', () => {
    const centres = spreadColumn(
      [
        { id: 'b', centre: 105, height: 32 },
        { id: 'a', centre: 100, height: 32 },
      ],
      0,
      400,
    );
    // a keeps its place; b starts 2px below a's bottom edge (116).
    expect(centres.get('a')).toBe(100);
    expect(centres.get('b')).toBe(116 + 2 + 16);
  });

  it('pulls a run that spilled past the bottom back inside the frame', () => {
    const centres = spreadColumn(
      [
        { id: 'a', centre: 390, height: 32 },
        { id: 'b', centre: 395, height: 32 },
      ],
      0,
      400,
    );
    expect(centres.get('b')).toBe(400 - 16);
    expect(centres.get('a')).toBe(400 - 32 - 2 - 16);
  });
});

describe('placeInsideLabels', () => {
  // Three columns at x 0, 174 and 348 (a 360px frame with 12px nodes).
  const nodes = [
    node('Natural gas', 0, 0, 0, 200),
    node('Electricity generation', 1, 174, 0, 300),
    node('Rejected energy', 2, 348, 0, 250),
    node('Homes', 2, 348, 260, 300),
  ];

  it('labels the first and interior columns right of the node, the last column left', () => {
    const placed = placeInsideLabels(nodes, frame, metrics);
    expect(placed.get('Natural gas')).toMatchObject({ anchor: 'start', x: 18 });
    expect(placed.get('Electricity generation')).toMatchObject({ anchor: 'start', x: 192 });
    expect(placed.get('Rejected energy')).toMatchObject({ anchor: 'end', x: 342 });
  });

  it('wraps each label at the gap to the neighbouring column, not the frame edge', () => {
    const placed = placeInsideLabels(nodes, frame, metrics);
    // Room from 192 to the next column's left edge (348) less the 6px gap.
    expect(placed.get('Electricity generation')?.maxWidth).toBe(150);
    // 154px of text: it would fit the 168px to the frame edge, but not the gap.
    expect(placed.get('Electricity generation')?.lines).toEqual(['Electricity', 'generation']);
    // The last column's room runs back to the previous column's right edge (186).
    expect(placed.get('Rejected energy')?.maxWidth).toBe(342 - 192);
  });

  it('falls back to the frame edge when a single word cannot fit the gap', () => {
    const tight = [node('Electricity', 0, 0, 0, 200), node('Homes', 1, 60, 0, 200)];
    const placed = placeInsideLabels(tight, frame, metrics);
    expect(placed.get('Electricity')?.maxWidth).toBe(360 - 18);
  });

  it('centres a block on its node and keeps neighbouring blocks apart', () => {
    const crowded = [
      node('Coal', 0, 0, 100, 104),
      node('Biomass', 0, 0, 108, 110),
      node('Geothermal', 0, 0, 114, 115),
      node('Sink', 1, 300, 0, 400),
    ];
    const placed = placeInsideLabels(crowded, frame, metrics);
    expect(placed.get('Coal')?.y).toBe(102);
    // Each block is two lines (name and value) of 16px.
    const ys = ['Coal', 'Biomass', 'Geothermal'].map((id) => placed.get(id)!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(32);
  });
});
