/**
 * Keyboard navigation over per-mark tooltips (the bar/point branch).
 *
 * The crosshair branch (line/area) is covered in crosshair-emphasis.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

function keydown(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** The tooltip element is reused, so visibility is `display`, not presence. */
function tooltipDisplay(): string {
  const el = document.querySelector('.oc-tooltip') as HTMLElement | null;
  return el?.style.display ?? 'missing';
}

describe('mark keyboard navigation', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ArrowRight focuses a mark and shows its tooltip', () => {
    const chart = createChart(container, barSpec);

    keydown(container, 'ArrowRight');

    expect(container.querySelector('.oc-mark-focused')).not.toBeNull();
    expect(tooltipDisplay()).toBe('block');

    chart.destroy();
  });

  it('clears the focus ring and tooltip when the container loses focus', () => {
    const chart = createChart(container, barSpec);

    keydown(container, 'ArrowRight');
    expect(container.querySelector('.oc-mark-focused')).not.toBeNull();

    // Tabbing away must not leave a tooltip and a focus ring painted over the
    // chart with nothing focused.
    container.dispatchEvent(new FocusEvent('blur'));

    expect(container.querySelector('.oc-mark-focused')).toBeNull();
    expect(tooltipDisplay()).toBe('none');

    chart.destroy();
  });

  it('drops the blur listener on destroy', () => {
    const chart = createChart(container, barSpec);
    keydown(container, 'ArrowRight');
    chart.destroy();

    // No listener, no throw, and nothing to clean up: the chart is gone.
    expect(() => container.dispatchEvent(new FocusEvent('blur'))).not.toThrow();
    expect(container.querySelector('.oc-tooltip')).toBeNull();
  });

  it('the focus ring survives a keypress that is not blur', () => {
    const chart = createChart(container, barSpec);
    keydown(container, 'ArrowRight');
    keydown(container, 'ArrowRight');
    expect(container.querySelector('.oc-mark-focused')).not.toBeNull();
    chart.destroy();
  });
});
