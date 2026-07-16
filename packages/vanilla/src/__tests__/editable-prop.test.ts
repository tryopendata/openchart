import type { ChartSpec, ElementEdit } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Shared specs
// ---------------------------------------------------------------------------

const textAnnotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [
    { type: 'text', x: 10, y: 'A', text: 'Peak', offset: { dx: 10, dy: -20 }, connector: true },
  ],
};

const fullEditSpec: ChartSpec = {
  ...lineSpec,
  labels: { show: true },
  annotations: [
    {
      type: 'text',
      x: '2020-01-01',
      y: 10,
      text: 'Peak',
      offset: { dx: 10, dy: -20 },
      connector: true,
    },
  ],
  chrome: {
    title: 'GDP Growth',
    subtitle: 'US vs UK over time',
    source: 'World Bank',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulateDrag(
  el: Element,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  el.dispatchEvent(createMouseEvent('mousedown', startX, startY));
  document.dispatchEvent(createMouseEvent('mousemove', endX, endY));
  document.dispatchEvent(createMouseEvent('mouseup', endX, endY));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('editable prop', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('editable: false suppresses annotation drag even when onEdit is provided', () => {
    const onEdit = vi.fn();
    const chart = createChart(container, textAnnotatedSpec, { onEdit, editable: false });

    const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
    if (!annotation) {
      chart.destroy();
      return;
    }

    // Should NOT have grab cursor
    expect(annotation.style.cursor).not.toBe('grab');

    simulateDrag(annotation, 100, 100, 150, 130);
    expect(onEdit).not.toHaveBeenCalled();

    chart.destroy();
  });

  it('editable: false suppresses selection even when onSelect is provided', () => {
    const onSelect = vi.fn();
    const chart = createChart(container, textAnnotatedSpec, { onSelect, editable: false });

    // SVG should not have tabindex (makeEditable not called)
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('tabindex')).toBeNull();

    // Click an annotation
    const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
    if (annotation) {
      annotation.dispatchEvent(createMouseEvent('click', 100, 100));
    }
    expect(onSelect).not.toHaveBeenCalled();

    chart.destroy();
  });

  it('editable: false suppresses keyboard delete even when onEdit is provided', () => {
    const onEdit = vi.fn();
    const chart = createChart(container, textAnnotatedSpec, { onEdit, editable: false });

    // SVG should not have tabindex (makeEditable not called)
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('tabindex')).toBeNull();

    // Simulate Delete key
    const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    svg?.dispatchEvent(deleteEvent);

    // No delete edit should fire
    const deleteEdits = onEdit.mock.calls.filter(
      (call: [ElementEdit]) => call[0].type === 'delete',
    );
    expect(deleteEdits).toHaveLength(0);

    chart.destroy();
  });

  it('editable: true enables interaction layer without callbacks', () => {
    const chart = createChart(container, textAnnotatedSpec, { editable: true });

    // SVG should have tabindex="0" from makeEditable
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('tabindex')).toBe('0');

    chart.destroy();
  });

  it('editable: undefined preserves legacy behavior (callbacks gate interactions)', () => {
    const onEdit = vi.fn();
    const chart = createChart(container, textAnnotatedSpec, { onEdit });

    const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
    if (!annotation) {
      chart.destroy();
      return;
    }

    // Should have grab cursor (legacy: onEdit gates annotation drag)
    expect(annotation.style.cursor).toBe('grab');

    simulateDrag(annotation, 100, 100, 150, 130);
    expect(onEdit).toHaveBeenCalledTimes(1);

    chart.destroy();
  });

  it('editable: false suppresses chrome/legend drag even when onEdit is provided', () => {
    const onEdit = vi.fn();
    const chart = createChart(container, fullEditSpec, { onEdit, editable: false });

    // Chrome elements should not have grab cursor
    const chromeTexts = container.querySelectorAll('.oc-chrome text[data-chrome-key]');
    for (const el of chromeTexts) {
      expect((el as HTMLElement).style.cursor).not.toBe('grab');
    }

    // Legend should not have grab cursor
    const legendG = container.querySelector('.oc-legend') as SVGGElement | null;
    if (legendG) {
      expect(legendG.style.cursor).not.toBe('grab');
    }

    chart.destroy();
  });
});
