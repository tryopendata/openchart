import { describe, expect, it } from 'vitest';
import {
  type LabelNode,
  placeInsideLabels,
  shouldPlaceLabelsInside,
  spreadLabelBlocks,
} from '../label-placement';

// A font that draws every character 7px wide keeps the arithmetic readable.
const metrics = {
  fontSize: 12,
  fontWeight: 500,
  valueFontWeight: 400,
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
  value: '1.00',
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

describe('spreadLabelBlocks', () => {
  it('leaves blocks that do not touch where they are', () => {
    const { centres } = spreadLabelBlocks(
      [
        { id: 'a', centre: 50, height: 20, left: 0, right: 50 },
        { id: 'b', centre: 200, height: 20, left: 0, right: 50 },
      ],
      0,
      400,
    );
    expect(centres.get('a')).toBe(50);
    expect(centres.get('b')).toBe(200);
  });

  it('pushes an overlapping block down below its neighbour, in order', () => {
    const { centres } = spreadLabelBlocks(
      [
        { id: 'b', centre: 105, height: 32, left: 0, right: 50 },
        { id: 'a', centre: 100, height: 32, left: 0, right: 50 },
      ],
      0,
      400,
    );
    // a keeps its place; b starts 2px below a's bottom edge (116).
    expect(centres.get('a')).toBe(100);
    expect(centres.get('b')).toBe(116 + 2 + 16);
  });

  it('pulls a run that spilled past the bottom back inside the frame', () => {
    const { centres } = spreadLabelBlocks(
      [
        { id: 'a', centre: 390, height: 32, left: 0, right: 50 },
        { id: 'b', centre: 395, height: 32, left: 0, right: 50 },
      ],
      0,
      400,
    );
    expect(centres.get('b')).toBe(400 - 16);
    expect(centres.get('a')).toBe(400 - 32 - 2 - 16);
  });

  it('separates labels from two columns only when their text reaches across the gap', () => {
    // A label right of one column (from 192) and one left of the next (to 342).
    const meeting = (rightEdge: number, leftEdge: number) =>
      spreadLabelBlocks(
        [
          { id: 'interior', centre: 100, height: 32, left: 192, right: rightEdge },
          { id: 'last', centre: 100, height: 32, left: leftEdge, right: 342 },
        ],
        0,
        400,
      );
    expect(meeting(260, 280).centres.get('last')).toBe(100);
    expect(meeting(300, 280).centres.get('last')).toBe(100 + 32 + 2);
  });

  it('keeps every block of an overfull column inside the frame', () => {
    const blocks = [
      { id: 'a', centre: 10, height: 40, left: 0, right: 50 },
      { id: 'b', centre: 10, height: 40, left: 0, right: 50 },
    ];
    const { centres, fits } = spreadLabelBlocks(blocks, 0, 50);
    expect(fits).toBe(false);
    for (const block of blocks) {
      const centre = centres.get(block.id)!;
      expect(centre - block.height / 2).toBeGreaterThanOrEqual(0);
      expect(centre + block.height / 2).toBeLessThanOrEqual(50);
    }
    // Order is kept: a stays above (or level with) b.
    expect(centres.get('a')!).toBeLessThanOrEqual(centres.get('b')!);
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
    expect(placed.get('Coal')?.showValue).toBe(true);
  });

  it('drops value lines first when a column cannot hold every block', () => {
    // Five 2-line blocks (32px each plus gaps) need 168px; 1-line blocks need 88px.
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const column = [
      ...ids.map((id, i) => node(id, 0, 0, i * 20, i * 20 + 10)),
      node('Z', 1, 300, 0, 100),
    ];
    const placed = placeInsideLabels(column, { ...frame, bottom: 100 }, metrics);
    for (const id of ids) {
      const label = placed.get(id)!;
      expect(label.showValue).toBe(false);
      expect(label.y - 8).toBeGreaterThanOrEqual(0);
      expect(label.y + 8).toBeLessThanOrEqual(100);
    }
    const ys = ids.map((id) => placed.get(id)!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(16);
  });
});
