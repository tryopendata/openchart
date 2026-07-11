/**
 * Series search (`seriesSearch`) interaction tests.
 *
 * Mounts real charts via createChart into a happy-dom container and drives
 * the combobox with real keyboard/input events, asserting on visible
 * behavior: ARIA state, chips, and the stroke colors the renderer applies
 * to line marks when the highlight set changes.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type ChartInstance, createChart } from '../mount';

/** Neutral gray the engine assigns to non-highlighted series. */
const MUTED = '#bfc3c8';

const COUNTRIES = ['United States', 'Germany', 'France', 'Georgia', 'México'];

function makeSearchSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  const data = COUNTRIES.flatMap((country, i) => [
    { year: '2020-01-01', value: 10 + i * 5, country },
    { year: '2021-01-01', value: 14 + i * 5, country },
  ]);
  return {
    mark: 'line',
    data,
    encoding: {
      x: { field: 'year', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'country', type: 'nominal' },
    },
    seriesSearch: true,
    ...overrides,
  } as ChartSpec;
}

function getInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('.oc-series-search-input');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

function getListbox(container: HTMLElement): HTMLUListElement {
  return container.querySelector('.oc-series-search-listbox') as HTMLUListElement;
}

function optionLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.oc-series-search-option')].map(
    (el) => el.textContent ?? '',
  );
}

function chipLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.oc-series-search-chip')].map((el) =>
    (el.textContent ?? '').trim(),
  );
}

function typeText(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** Stroke color the renderer applied to a series' line mark. */
function seriesStroke(container: HTMLElement, series: string): string | null {
  const g = container.querySelector(`g.oc-mark-line[data-series="${series}"]`);
  return g?.querySelector('path')?.getAttribute('stroke') ?? null;
}

function removeChip(container: HTMLElement, series: string): void {
  const button = container.querySelector(
    `.oc-series-search-chip-remove[aria-label="Remove ${series}"]`,
  ) as HTMLButtonElement | null;
  expect(button).not.toBeNull();
  button!.click();
}

describe('series search', () => {
  let container: HTMLDivElement;
  let chart: ChartInstance | null = null;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    chart?.destroy();
    chart = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders an ARIA combobox with the configured placeholder', () => {
    chart = createChart(
      container,
      makeSearchSpec({ seriesSearch: { placeholder: 'Find a country' } }),
    );

    const input = getInput(container);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.placeholder).toBe('Find a country');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');

    const listbox = getListbox(container);
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.hidden).toBe(true);
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
  });

  it('supports the full keyboard path: arrows open and navigate, Enter selects, Escape closes', () => {
    chart = createChart(container, makeSearchSpec());
    const input = getInput(container);
    input.focus();

    // ArrowDown opens the list with every series suggested
    press(input, 'ArrowDown');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(getListbox(container).hidden).toBe(false);
    expect(optionLabels(container)).toEqual(COUNTRIES);
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();

    // Arrows move the active option (aria-activedescendant tracks it)
    const first = input.getAttribute('aria-activedescendant');
    press(input, 'ArrowDown');
    const second = input.getAttribute('aria-activedescendant');
    expect(second).not.toBe(first);
    press(input, 'ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe(first);

    // Enter selects the active option as a chip and closes the list
    press(input, 'Enter');
    expect(chipLabels(container)).toEqual(['United States']);
    expect(input.getAttribute('aria-expanded')).toBe('false');

    // Escape closes a re-opened list
    press(input, 'ArrowDown');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    press(input, 'Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(getListbox(container).hidden).toBe(true);
  });

  it('typing "ger" then Enter saturates Germany; adding France gives two; removing chips restores', () => {
    chart = createChart(container, makeSearchSpec());
    const input = getInput(container);

    // Capture the palette colors before any search interaction
    const initialStrokes = new Map(COUNTRIES.map((c) => [c, seriesStroke(container, c)]));
    for (const c of COUNTRIES) expect(initialStrokes.get(c)).not.toBe(MUTED);

    // "ger" matches Germany only (Georgia shares "ge" but not "ger")
    typeText(input, 'ger');
    expect(optionLabels(container)).toEqual(['Germany']);
    press(input, 'Enter');

    expect(chipLabels(container)).toEqual(['Germany']);
    expect(seriesStroke(container, 'Germany')).not.toBe(MUTED);
    for (const c of COUNTRIES.filter((c) => c !== 'Germany')) {
      expect(seriesStroke(container, c)).toBe(MUTED);
    }

    // Add France: two saturated series
    typeText(input, 'fra');
    expect(optionLabels(container)).toEqual(['France']);
    press(input, 'Enter');
    expect(chipLabels(container)).toEqual(['Germany', 'France']);
    expect(seriesStroke(container, 'Germany')).not.toBe(MUTED);
    expect(seriesStroke(container, 'France')).not.toBe(MUTED);
    expect(seriesStroke(container, 'United States')).toBe(MUTED);

    // Removing both chips restores the original palette assignment
    removeChip(container, 'France');
    removeChip(container, 'Germany');
    expect(chipLabels(container)).toEqual([]);
    for (const c of COUNTRIES) {
      expect(seriesStroke(container, c)).toBe(initialStrokes.get(c));
    }
  });

  it('clearing the search restores the authored highlight baseline exactly', () => {
    chart = createChart(
      container,
      makeSearchSpec({
        encoding: {
          x: { field: 'year', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'country', type: 'nominal', highlight: ['United States'] },
        },
      } as Partial<ChartSpec>),
    );
    const input = getInput(container);

    // Authored baseline: US saturated, everything else muted
    const baselineStrokes = new Map(COUNTRIES.map((c) => [c, seriesStroke(container, c)]));
    expect(baselineStrokes.get('United States')).not.toBe(MUTED);
    expect(baselineStrokes.get('Germany')).toBe(MUTED);

    // Selecting Germany adds to the baseline set (US stays saturated)
    typeText(input, 'ger');
    press(input, 'Enter');
    expect(seriesStroke(container, 'Germany')).not.toBe(MUTED);
    expect(seriesStroke(container, 'United States')).not.toBe(MUTED);

    // Clearing restores the authored baseline for every series
    removeChip(container, 'Germany');
    for (const c of COUNTRIES) {
      expect(seriesStroke(container, c)).toBe(baselineStrokes.get(c));
    }
  });

  it('fires onHighlightChange with the full current set on every change', () => {
    const onHighlightChange = vi.fn();
    chart = createChart(
      container,
      makeSearchSpec({
        encoding: {
          x: { field: 'year', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'country', type: 'nominal', highlight: ['United States'] },
        },
      } as Partial<ChartSpec>),
      { onHighlightChange },
    );
    const input = getInput(container);

    typeText(input, 'ger');
    press(input, 'Enter');
    expect(onHighlightChange).toHaveBeenLastCalledWith(['United States', 'Germany']);

    typeText(input, 'fra');
    press(input, 'Enter');
    expect(onHighlightChange).toHaveBeenLastCalledWith(['United States', 'Germany', 'France']);

    removeChip(container, 'Germany');
    expect(onHighlightChange).toHaveBeenLastCalledWith(['United States', 'France']);

    removeChip(container, 'France');
    expect(onHighlightChange).toHaveBeenLastCalledWith(['United States']);
    expect(onHighlightChange).toHaveBeenCalledTimes(4);
  });

  it('matches diacritic-insensitively', () => {
    chart = createChart(container, makeSearchSpec());
    const input = getInput(container);

    typeText(input, 'mex');
    expect(optionLabels(container)).toEqual(['México']);

    typeText(input, 'MÉX');
    expect(optionLabels(container)).toEqual(['México']);
  });

  it('Backspace on an empty input removes the last chip', () => {
    chart = createChart(container, makeSearchSpec());
    const input = getInput(container);

    typeText(input, 'ger');
    press(input, 'Enter');
    typeText(input, 'fra');
    press(input, 'Enter');
    expect(chipLabels(container)).toEqual(['Germany', 'France']);

    press(input, 'Backspace');
    expect(chipLabels(container)).toEqual(['Germany']);
  });

  it('suppresses edit mode with a warning when both are enabled (search wins)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    chart = createChart(container, makeSearchSpec(), {
      onEdit: () => {},
      onSelect: () => {},
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mutually exclusive'));

    // Search input mounted; edit affordances (focusable SVG) are not wired
    expect(container.querySelector('.oc-series-search-input')).not.toBeNull();
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('tabindex')).toBeNull();
  });

  it('update() resets search selections to the new spec baseline', () => {
    chart = createChart(container, makeSearchSpec());
    const input = getInput(container);

    typeText(input, 'ger');
    press(input, 'Enter');
    expect(chipLabels(container)).toEqual(['Germany']);

    chart.update(makeSearchSpec());
    expect(chipLabels(container)).toEqual([]);
    for (const c of COUNTRIES) {
      expect(seriesStroke(container, c)).not.toBe(MUTED);
    }
  });

  it('destroy() removes the search control from the DOM', () => {
    chart = createChart(container, makeSearchSpec());
    expect(container.querySelector('.oc-series-search')).not.toBeNull();

    chart.destroy();
    chart = null;
    expect(container.querySelector('.oc-series-search')).toBeNull();
  });
});
