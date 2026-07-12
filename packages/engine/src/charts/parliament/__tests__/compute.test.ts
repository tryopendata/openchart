import type {
  ChartLayout,
  PointMark,
  RuleMarkLayout,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compileChart } from '../../../compile';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** US House 2023: 213 Democrats, 222 Republicans = 435 seats, majority 218. */
const usHouse = [
  { party: 'Democratic', seats: 213 },
  { party: 'Republican', seats: 222 },
];

const partyColors = { range: ['#1b7fa3', '#c44e52'] };

function compileHouse(overrides: Record<string, unknown> = {}): ChartLayout {
  return compileChart(
    {
      mark: 'parliament',
      data: usHouse,
      encoding: {
        theta: { field: 'seats', type: 'quantitative' },
        color: { field: 'party', type: 'nominal', scale: partyColors },
      },
      ...overrides,
    },
    { width: 640, height: 400 },
  );
}

function seatMarks(layout: ChartLayout): PointMark[] {
  return layout.marks.filter((m): m is PointMark => m.type === 'point');
}

// ---------------------------------------------------------------------------
// Seat counts (acceptance: rendered dots per party == data)
// ---------------------------------------------------------------------------

describe('parliament seat counts', () => {
  it('renders exactly one seat dot per seat in the data', () => {
    const layout = compileHouse();
    expect(seatMarks(layout)).toHaveLength(435);
  });

  it('renders the correct number of seats per party', () => {
    const layout = compileHouse();
    const byParty = new Map<string, number>();
    for (const seat of seatMarks(layout)) {
      const party = String(seat.data.party);
      byParty.set(party, (byParty.get(party) ?? 0) + 1);
    }
    expect(byParty.get('Democratic')).toBe(213);
    expect(byParty.get('Republican')).toBe(222);
  });

  it('rounds fractional seat values to whole seats', () => {
    const layout = compileChart(
      {
        mark: 'parliament',
        data: [
          { party: 'A', seats: 10.4 },
          { party: 'B', seats: 5.6 },
        ],
        encoding: {
          theta: { field: 'seats', type: 'quantitative' },
          color: { field: 'party', type: 'nominal', scale: { range: ['#111', '#222'] } },
        },
      },
      { width: 640, height: 400 },
    );
    // 10.4 -> 10, 5.6 -> 6 = 16 seats total.
    expect(seatMarks(layout)).toHaveLength(16);
  });

  it('assigns each party its scale color to every one of its seats', () => {
    const layout = compileHouse();
    const dem = seatMarks(layout).filter((s) => s.data.party === 'Democratic');
    const gop = seatMarks(layout).filter((s) => s.data.party === 'Republican');
    expect(dem.every((s) => s.fill === '#1b7fa3')).toBe(true);
    expect(gop.every((s) => s.fill === '#c44e52')).toBe(true);
  });

  it('groups each party into a contiguous left-to-right block', () => {
    const layout = compileHouse();
    // Seat marks are emitted party-by-party in data order, so the first 213
    // are Democratic and the rest Republican.
    const parties = seatMarks(layout).map((s) => String(s.data.party));
    const firstGop = parties.indexOf('Republican');
    expect(firstGop).toBe(213);
    expect(parties.slice(0, 213).every((p) => p === 'Democratic')).toBe(true);
    expect(parties.slice(213).every((p) => p === 'Republican')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hemicycle geometry
// ---------------------------------------------------------------------------

describe('parliament geometry', () => {
  it('keeps every seat dot inside the chart bounds', () => {
    const layout = compileHouse();
    const svgW = layout.dimensions.width;
    const svgH = layout.dimensions.height;
    for (const seat of seatMarks(layout)) {
      expect(seat.cx - seat.r).toBeGreaterThanOrEqual(0);
      expect(seat.cx + seat.r).toBeLessThanOrEqual(svgW);
      expect(seat.cy - seat.r).toBeGreaterThanOrEqual(0);
      expect(seat.cy + seat.r).toBeLessThanOrEqual(svgH);
    }
  });

  it('arranges seats in a hemicycle (dots span a wide arc, not a single column)', () => {
    const layout = compileHouse();
    const xs = seatMarks(layout).map((s) => s.cx);
    const spread = Math.max(...xs) - Math.min(...xs);
    // A real hemicycle spans most of the width; a degenerate column would be ~0.
    expect(spread).toBeGreaterThan(layout.dimensions.width / 2);
  });

  it('gives every seat a positive radius', () => {
    const layout = compileHouse();
    expect(seatMarks(layout).every((s) => s.r > 0)).toBe(true);
  });

  it('assigns sequential animation indices for the entrance stagger', () => {
    const layout = compileHouse();
    const indices = seatMarks(layout).map((s) => s.animationIndex);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(434);
  });
});

// ---------------------------------------------------------------------------
// Majority line
// ---------------------------------------------------------------------------

describe('parliament majority line', () => {
  it('draws a majority rule and a "218 to win" label by default', () => {
    const layout = compileHouse();
    const rule = layout.marks.find((m): m is RuleMarkLayout => m.type === 'rule');
    const label = layout.marks.find((m): m is TextMarkLayout => m.type === 'textMark');
    expect(rule).toBeDefined();
    expect(label).toBeDefined();
    expect(label?.text).toBe('218 to win');
  });

  it('omits the majority line when majorityLine is false', () => {
    const layout = compileHouse({ mark: { type: 'parliament', majorityLine: false } });
    expect(layout.marks.some((m) => m.type === 'rule')).toBe(false);
    expect(layout.marks.some((m) => m.type === 'textMark')).toBe(false);
  });

  it('honors an explicit majority seat count and label override', () => {
    const layout = compileHouse({
      mark: { type: 'parliament', majorityLine: { seats: 300, label: 'Supermajority' } },
    });
    const label = layout.marks.find((m): m is TextMarkLayout => m.type === 'textMark');
    expect(label?.text).toBe('Supermajority');
  });

  it('accepts the object majorityLine form through the typed spec API', () => {
    // Authored as a fully-typed ChartSpec (not the Record<string, unknown>
    // overrides shim), so this covers the public type surface: MarkDef.
    // majorityLine must accept { seats, label }, not just boolean.
    const layout = compileChart(
      {
        mark: { type: 'parliament', majorityLine: { seats: 290 } },
        data: usHouse,
        encoding: {
          theta: { field: 'seats', type: 'quantitative' },
          color: { field: 'party', type: 'nominal', scale: partyColors },
        },
      },
      { width: 640, height: 400 },
    );
    const label = layout.marks.find((m): m is TextMarkLayout => m.type === 'textMark');
    expect(label?.text).toBe('290 to win');
  });

  describe('out-of-range majorityLine.seats', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });
    const warned = (): string[] => warnSpy.mock.calls.map((c) => String(c[0]));

    it('warns and falls back to the default when seats is above the chamber', () => {
      // 435-seat house; 999 would draw the marker off the seat arc. The mark
      // falls back to the simple majority (218) and a warning surfaces through
      // the shared compile warnings channel (emitted once, deduped).
      const layout = compileHouse({
        mark: { type: 'parliament', majorityLine: { seats: 999 } },
      });
      const warning = warned().find((w) => w.includes('majorityLine.seats'));
      expect(warning).toBeDefined();
      expect(warning).toContain('999');
      expect(warning).toContain('1..435');
      expect(warning).toContain('218');

      // The rendered label uses the fallback, not the out-of-range value.
      const label = layout.marks.find((m): m is TextMarkLayout => m.type === 'textMark');
      expect(label?.text).toBe('218 to win');
    });

    it('warns for seats below 1 (e.g. { seats: 0 })', () => {
      compileHouse({ mark: { type: 'parliament', majorityLine: { seats: 0 } } });
      expect(warned().some((w) => w.includes('majorityLine.seats'))).toBe(true);
    });

    it('does not warn for an in-range seats override', () => {
      compileHouse({ mark: { type: 'parliament', majorityLine: { seats: 290 } } });
      expect(warned().filter((w) => w.includes('majorityLine.seats'))).toEqual([]);
    });
  });

  it('computes the default majority as floor(total/2)+1 for an odd chamber', () => {
    // 3 + 2 = 5 seats, majority = 3.
    const layout = compileChart(
      {
        mark: 'parliament',
        data: [
          { party: 'A', seats: 3 },
          { party: 'B', seats: 2 },
        ],
        encoding: {
          theta: { field: 'seats', type: 'quantitative' },
          color: { field: 'party', type: 'nominal', scale: { range: ['#111', '#222'] } },
        },
      },
      { width: 640, height: 400 },
    );
    const label = layout.marks.find((m): m is TextMarkLayout => m.type === 'textMark');
    expect(label?.text).toBe('3 to win');
  });
});

// ---------------------------------------------------------------------------
// Tooltips, legend, a11y
// ---------------------------------------------------------------------------

describe('parliament tooltips and accessibility', () => {
  it('shares one tooltip per party across all its seats', () => {
    const layout = compileHouse();
    const seats = seatMarks(layout);
    // Every seat mark has a matching point-${index} descriptor.
    const demIndices: number[] = [];
    layout.marks.forEach((m, i) => {
      if (m.type === 'point' && m.data.party === 'Democratic') demIndices.push(i);
    });
    const contents = demIndices.map((i) => layout.tooltipDescriptors.get(`point-${i}`));
    expect(contents.every((c) => c !== undefined)).toBe(true);
    // All Democratic seats share the same tooltip object (single hover target).
    expect(new Set(contents).size).toBe(1);
    expect(contents[0]?.title).toBe('Democratic');
    expect(seats.length).toBe(435);
  });

  it('reports seat count and share in the party tooltip', () => {
    const layout = compileHouse();
    const firstDem = layout.marks.findIndex(
      (m) => m.type === 'point' && m.data.party === 'Democratic',
    );
    const content = layout.tooltipDescriptors.get(`point-${firstDem}`);
    expect(content?.fields.some((f) => f.value === '213')).toBe(true);
    expect(content?.fields.some((f) => f.label === 'Share' && f.value.includes('%'))).toBe(true);
  });

  it('gives no tooltip to the majority line or label', () => {
    const layout = compileHouse();
    const ruleIndex = layout.marks.findIndex((m) => m.type === 'rule');
    const labelIndex = layout.marks.findIndex((m) => m.type === 'textMark');
    expect(layout.tooltipDescriptors.get(`rule-${ruleIndex}`)).toBeUndefined();
    expect(layout.tooltipDescriptors.get(`textMark-${labelIndex}`)).toBeUndefined();
  });

  it('builds a per-party legend', () => {
    const layout = compileHouse();
    const labels = layout.legend.entries.map((e) => e.label);
    expect(labels).toContain('Democratic');
    expect(labels).toContain('Republican');
  });

  it('describes the chamber size and majority threshold in the alt text', () => {
    const layout = compileHouse();
    expect(layout.a11y.altText).toContain('435 seats');
    expect(layout.a11y.altText).toContain('218');
  });

  it('labels a representative seat per party for screen readers, rest decorative', () => {
    const layout = compileHouse();
    const dem = seatMarks(layout).filter((s) => s.data.party === 'Democratic');
    const labeled = dem.filter((s) => !s.aria.decorative);
    expect(labeled).toHaveLength(1);
    expect(labeled[0].aria.label).toContain('213 seats');
  });
});

// ---------------------------------------------------------------------------
// Edge cases and errors
// ---------------------------------------------------------------------------

describe('parliament edge cases', () => {
  it('rejects empty data with a clear spec error', () => {
    expect(() =>
      compileChart(
        {
          mark: 'parliament',
          data: [],
          encoding: {
            theta: { field: 'seats', type: 'quantitative' },
            color: { field: 'party', type: 'nominal', scale: { range: ['#111'] } },
          },
        },
        { width: 640, height: 400 },
      ),
    ).toThrow(/non-empty array/);
  });

  it('produces no seat marks when all seat values are zero', () => {
    const layout = compileChart(
      {
        mark: 'parliament',
        data: [
          { party: 'A', seats: 0 },
          { party: 'B', seats: 0 },
        ],
        encoding: {
          theta: { field: 'seats', type: 'quantitative' },
          color: { field: 'party', type: 'nominal', scale: { range: ['#111', '#222'] } },
        },
      },
      { width: 640, height: 400 },
    );
    expect(seatMarks(layout)).toHaveLength(0);
  });

  it('ignores negative seat values rather than crashing', () => {
    const layout = compileChart(
      {
        mark: 'parliament',
        data: [
          { party: 'A', seats: 10 },
          { party: 'B', seats: -5 },
        ],
        encoding: {
          theta: { field: 'seats', type: 'quantitative' },
          color: { field: 'party', type: 'nominal', scale: { range: ['#111', '#222'] } },
        },
      },
      { width: 640, height: 400 },
    );
    // Only the 10 valid seats render; the negative party contributes none.
    expect(seatMarks(layout)).toHaveLength(10);
  });

  it('handles a multi-party chamber (8 parties) with all seats accounted for', () => {
    const euStyle = [
      { party: 'Left', seats: 39 },
      { party: 'Greens', seats: 71 },
      { party: 'S&D', seats: 139 },
      { party: 'Renew', seats: 102 },
      { party: 'EPP', seats: 178 },
      { party: 'ECR', seats: 69 },
      { party: 'ID', seats: 49 },
      { party: 'NI', seats: 58 },
    ];
    const total = euStyle.reduce((s, p) => s + p.seats, 0);
    const layout = compileChart(
      {
        mark: 'parliament',
        data: euStyle,
        encoding: {
          theta: { field: 'seats', type: 'quantitative' },
          color: {
            field: 'party',
            type: 'nominal',
            scale: {
              range: [
                '#8b1a1a',
                '#3d9970',
                '#c44e52',
                '#f0a202',
                '#1b7fa3',
                '#2c3e88',
                '#5b6ee1',
                '#888',
              ],
            },
          },
        },
      },
      { width: 800, height: 460 },
    );
    expect(seatMarks(layout)).toHaveLength(total);
    const parties = new Set(seatMarks(layout).map((s) => String(s.data.party)));
    expect(parties.size).toBe(8);
  });
});
