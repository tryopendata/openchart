import { CATEGORICAL_PALETTE_DARK } from '@opendata-ai/openchart-core';
import { migrateSpecV8 } from '@opendata-ai/openchart-engine';
import { expect, it, vi } from 'vitest';
import { createChart } from '../index';

it.each([
  [undefined, false],
  ['off', false],
  ['force', true],
  ['auto', true],
] as const)('mounts serialized migrated palettes with darkMode=%s', (darkMode, dark) => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  const host = document.createElement('div');
  const spec = JSON.parse(
    JSON.stringify(
      migrateSpecV8({
        mark: 'point',
        data: [{ x: 0, y: 1 }],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      }).spec,
    ),
  );
  const chart = createChart(host, spec, { darkMode, autoResize: false });
  try {
    expect(chart.layout.theme.isDark).toBe(dark);
    expect(chart.layout.theme.colors.categorical[0]).toBe(
      dark ? CATEGORICAL_PALETTE_DARK[0] : '#06b6d4',
    );
  } finally {
    chart.destroy();
    media.mockRestore();
  }
});
