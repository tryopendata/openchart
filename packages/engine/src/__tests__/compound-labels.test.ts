import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const albumData = [
  { album: 'Abbey Road', artist: 'The Beatles', sales: 31 },
  { album: 'Thriller', artist: 'Michael Jackson', sales: 66 },
  { album: 'Back in Black', artist: 'AC/DC', sales: 50 },
  { album: 'The Dark Side of the Moon', artist: 'Pink Floyd', sales: 45 },
  { album: 'Rumours', artist: 'Fleetwood Mac', sales: 40 },
];

function makeBarSpec(axisConfig?: Record<string, unknown>) {
  return {
    mark: 'bar' as const,
    data: albumData,
    encoding: {
      x: { field: 'sales', type: 'quantitative' as const },
      y: {
        field: 'album',
        type: 'nominal' as const,
        axis: axisConfig,
      },
    },
  };
}

const compileOpts = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compound axis labels (labelField)', () => {
  it('populates subtitle on ticks when labelField is set', () => {
    const spec = makeBarSpec({ labelField: 'artist' });
    const layout = compileChart(spec, compileOpts);

    const yTicks = layout.axes.y?.ticks ?? [];
    expect(yTicks.length).toBeGreaterThan(0);

    // Every tick should have a subtitle matching the artist for that album
    for (const tick of yTicks) {
      const row = albumData.find((r) => r.album === tick.label);
      expect(row).toBeDefined();
      expect(tick.subtitle).toBe(row!.artist);
    }
  });

  it('does not add subtitle when labelField is omitted', () => {
    const spec = makeBarSpec();
    const layout = compileChart(spec, compileOpts);

    const yTicks = layout.axes.y?.ticks ?? [];
    expect(yTicks.length).toBeGreaterThan(0);

    for (const tick of yTicks) {
      expect(tick.subtitle).toBeUndefined();
    }
  });

  it('handles missing labelField value gracefully', () => {
    const dataWithMissing = [
      { album: 'Abbey Road', artist: 'The Beatles', sales: 31 },
      { album: 'Unknown Album', sales: 20 }, // no artist field
    ];
    const spec = {
      mark: 'bar' as const,
      data: dataWithMissing,
      encoding: {
        x: { field: 'sales', type: 'quantitative' as const },
        y: {
          field: 'album',
          type: 'nominal' as const,
          axis: { labelField: 'artist' },
        },
      },
    };

    const layout = compileChart(spec, compileOpts);
    const yTicks = layout.axes.y?.ticks ?? [];

    // Abbey Road should have a subtitle
    const abbeyRoad = yTicks.find((t) => t.label === 'Abbey Road');
    expect(abbeyRoad?.subtitle).toBe('The Beatles');

    // Unknown Album has no artist field, so subtitle should be undefined
    const unknown = yTicks.find((t) => t.label === 'Unknown Album');
    expect(unknown?.subtitle).toBeUndefined();
  });

  it('maps subtitle correctly across multiple ticks', () => {
    const spec = makeBarSpec({ labelField: 'artist' });
    const layout = compileChart(spec, compileOpts);

    const yTicks = layout.axes.y?.ticks ?? [];
    expect(yTicks.length).toBe(5);

    // Verify specific mappings
    const thrillerTick = yTicks.find((t) => t.label === 'Thriller');
    expect(thrillerTick?.subtitle).toBe('Michael Jackson');

    const rumoursTick = yTicks.find((t) => t.label === 'Rumours');
    expect(rumoursTick?.subtitle).toBe('Fleetwood Mac');
  });

  it('preserves subtitle mapping with sort: descending', () => {
    const spec = {
      mark: 'bar' as const,
      data: albumData,
      encoding: {
        x: { field: 'sales', type: 'quantitative' as const },
        y: {
          field: 'album',
          type: 'nominal' as const,
          sort: 'descending' as const,
          axis: { labelField: 'artist' },
        },
      },
    };

    const layout = compileChart(spec, compileOpts);
    const yTicks = layout.axes.y?.ticks ?? [];

    // Regardless of sort order, each tick should still map to the right artist
    for (const tick of yTicks) {
      const row = albumData.find((r) => r.album === tick.label);
      expect(row).toBeDefined();
      expect(tick.subtitle).toBe(row!.artist);
    }
  });

  it('reserves wider dimension with labelField than without', () => {
    const specWith = makeBarSpec({ labelField: 'artist' });
    const specWithout = makeBarSpec();

    const layoutWith = compileChart(specWith, compileOpts);
    const layoutWithout = compileChart(specWithout, compileOpts);

    // Chart area x (left edge) should be larger with labelField because more
    // left margin is reserved for the wider compound labels
    expect(layoutWith.area.x).toBeGreaterThanOrEqual(layoutWithout.area.x);
  });
});
