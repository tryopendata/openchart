/**
 * seriesSearch compilation: band reservation and resolved content.
 *
 * The engine reserves an empty SVG band below chrome (and the metric bar)
 * and exposes its rect + the searchable values on layout.seriesSearch; the
 * vanilla adapter overlays the DOM combobox on that rect.
 */

import { describe, expect, it, vi } from 'vitest';
import { compileChart } from '../compile';

const searchSpec = {
  mark: 'line' as const,
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
    { date: '2020-01-01', value: 22, country: 'France' },
    { date: '2021-01-01', value: 28, country: 'France' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' as const },
    y: { field: 'value', type: 'quantitative' as const },
    color: { field: 'country', type: 'nominal' as const },
  },
  chrome: { title: 'Find your country' },
};

describe('compileChart seriesSearch', () => {
  it('omits the band when seriesSearch is not set', () => {
    const layout = compileChart(searchSpec, { width: 600, height: 400 });
    expect(layout.seriesSearch).toBeUndefined();
  });

  it('reserves a band below chrome and shifts the chart area down', () => {
    const base = compileChart(searchSpec, { width: 600, height: 400 });
    const layout = compileChart({ ...searchSpec, seriesSearch: true }, { width: 600, height: 400 });

    const band = layout.seriesSearch;
    expect(band).toBeDefined();
    expect(band!.height).toBeGreaterThan(0);
    expect(band!.width).toBeGreaterThan(0);
    // Band sits below the top chrome block and above the chart area
    expect(band!.y).toBeGreaterThanOrEqual(layout.chrome.topHeight);
    expect(band!.y + band!.height).toBeLessThanOrEqual(layout.area.y);
    // The reservation pushes the plot down relative to the no-search layout
    expect(layout.area.y).toBeGreaterThan(base.area.y);
  });

  it('exposes the distinct color values and resolved placeholder', () => {
    const layout = compileChart(
      { ...searchSpec, seriesSearch: { placeholder: 'Find a country' } },
      { width: 600, height: 400 },
    );
    expect(layout.seriesSearch?.values).toEqual(['US', 'UK', 'France']);
    expect(layout.seriesSearch?.placeholder).toBe('Find a country');

    const defaulted = compileChart(
      { ...searchSpec, seriesSearch: true },
      { width: 600, height: 400 },
    );
    expect(defaulted.seriesSearch?.placeholder).toBe('Find a series');
  });

  it('warns and disables when there is no categorical color encoding', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const layout = compileChart(
        {
          mark: 'line' as const,
          data: [
            { date: '2020-01-01', value: 10 },
            { date: '2021-01-01', value: 40 },
          ],
          encoding: {
            x: { field: 'date', type: 'temporal' as const },
            y: { field: 'value', type: 'quantitative' as const },
          },
          seriesSearch: true,
        },
        { width: 600, height: 400 },
      );
      expect(layout.seriesSearch).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('seriesSearch requires a categorical color encoding'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
