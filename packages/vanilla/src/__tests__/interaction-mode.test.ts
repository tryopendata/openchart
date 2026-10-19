import type { ChartSpec, EditTransaction } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { createChart, type MountOptions, resolveInteractionMode } from '../mount';

const textAnnotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [
    { type: 'text', x: 10, y: 'A', text: 'Peak', offset: { dx: 10, dy: -20 }, connector: true },
  ],
};

const fullEditSpec: ChartSpec = {
  ...lineSpec,
  annotations: [
    { type: 'text', x: '2020-01-01', y: 10, text: 'Peak', offset: { dx: 10, dy: -20 } },
  ],
  chrome: { title: 'GDP Growth', subtitle: 'US vs UK over time', source: 'World Bank' },
};

function simulateDrag(el: Element): void {
  el.dispatchEvent(createMouseEvent('mousedown', 100, 100));
  document.dispatchEvent(createMouseEvent('mousemove', 150, 130));
  document.dispatchEvent(createMouseEvent('mouseup', 150, 130));
}

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
}

describe('interaction mode', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function mount(spec: ChartSpec, options: MountOptions) {
    const chart = createChart(container, spec, { autoResize: false, ...options });
    const svg = container.querySelector('svg') as SVGSVGElement;
    const annotation = () => container.querySelector('.oc-annotation-text') as SVGGElement;
    return { chart, svg, annotation };
  }

  describe('resolveInteractionMode', () => {
    const fn = () => {};
    it.each<[MountOptions | undefined, string]>([
      [undefined, 'read'],
      [{}, 'read'],
      [{ onSelect: fn }, 'select'],
      [{ onDeselect: fn }, 'select'],
      [{ onEdit: fn }, 'edit'],
      [{ onEdit: fn, onSelect: fn }, 'edit'],
      [{ interaction: 'read', onEdit: fn }, 'read'],
      [{ interaction: 'select', onEdit: fn }, 'select'],
      [{ interaction: 'edit' }, 'edit'],
    ])('%o resolves to %s', (opts, mode) => {
      expect(resolveInteractionMode(opts)).toBe(mode);
    });
  });

  describe('read', () => {
    it('has no selection, drag, or delete even with callbacks', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const { chart, svg, annotation } = mount(textAnnotatedSpec, {
        interaction: 'read',
        onSelect,
        onEdit,
      });

      expect(annotation().style.cursor).not.toBe('grab');
      annotation().dispatchEvent(createMouseEvent('click', 100, 100));
      expect(onSelect).not.toHaveBeenCalled();
      expect(chart.getSelectedElement()).toBeNull();

      simulateDrag(annotation());
      key(svg, 'Delete');
      expect(onEdit).not.toHaveBeenCalled();
      chart.destroy();
    });

    it('ignores programmatic and initial selection', () => {
      const ref = { type: 'chrome', key: 'title' } as const;
      const { chart } = mount(fullEditSpec, { selectedElement: ref });
      expect(chart.getSelectedElement()).toBeNull();
      chart.select(ref);
      expect(chart.getSelectedElement()).toBeNull();
      expect(container.querySelector('.oc-selection-overlay')).toBeNull();
      chart.destroy();
    });

    it('is the inferred mode without callbacks and keeps reader keyboard nav', () => {
      const { chart, svg } = mount(barSpec, {});
      key(svg, 'ArrowRight');
      expect(container.querySelector('.oc-mark-focused')).not.toBeNull();
      chart.destroy();
    });

    it('chrome and legend are not draggable', () => {
      const { chart } = mount(fullEditSpec, { interaction: 'read', onEdit: vi.fn() });
      for (const el of container.querySelectorAll('.oc-chrome text[data-chrome-key]')) {
        expect((el as HTMLElement).style.cursor).not.toBe('grab');
      }
      const legend = container.querySelector('.oc-legend') as SVGGElement | null;
      if (legend) expect(legend.style.cursor).not.toBe('grab');
      chart.destroy();
    });
  });

  describe('select', () => {
    it.each<[string, Partial<MountOptions>]>([
      ['explicit', { interaction: 'select', onEdit: vi.fn() }],
      ['inferred from onSelect', {}],
    ])('%s: selects, keeps reader arrows, and never edits', (_label, extra) => {
      const onSelect = vi.fn();
      const { chart, svg, annotation } = mount(textAnnotatedSpec, { onSelect, ...extra });
      const onEdit = extra.onEdit as ReturnType<typeof vi.fn> | undefined;

      annotation().dispatchEvent(createMouseEvent('click', 100, 100));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(chart.getSelectedElement()).toMatchObject({ type: 'annotation', index: 0 });

      // Arrows still move the reader's data-point focus; nothing is nudged.
      const before = chart.layout.annotations[0].label!.x;
      key(svg, 'ArrowRight');
      expect(container.querySelector('.oc-mark-focused')).not.toBeNull();
      key(svg, 'Escape');
      expect(chart.layout.annotations[0].label!.x).toBe(before);

      // No drags, delete, or text editing.
      expect(annotation().style.cursor).not.toBe('grab');
      simulateDrag(annotation());
      annotation().dispatchEvent(createMouseEvent('click', 100, 100));
      key(svg, 'Delete');
      key(svg, 'Enter');
      annotation().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(chart.isTextEditing).toBe(false);
      expect(container.querySelector('textarea, input, [contenteditable]')).toBeNull();
      if (onEdit) expect(onEdit).not.toHaveBeenCalled();
      chart.destroy();
    });

    it('Tab selects editable elements', () => {
      const onSelect = vi.fn();
      const { chart, svg } = mount(fullEditSpec, { interaction: 'select', onSelect });
      key(svg, 'Tab');
      expect(onSelect).toHaveBeenCalledTimes(1);
      chart.destroy();
    });
  });

  describe('edit', () => {
    it('inferred from onEdit: arrows nudge instead of navigating', () => {
      const transactions: EditTransaction[] = [];
      const { chart, svg, annotation } = mount(textAnnotatedSpec, {
        onEdit: (tx) => transactions.push(tx),
      });
      expect(annotation().style.cursor).toBe('grab');
      annotation().dispatchEvent(createMouseEvent('click', 100, 100));
      key(svg, 'ArrowRight');
      expect(container.querySelector('.oc-mark-focused')).toBeNull();
      key(svg, 'Escape');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].ops.some((op) => op.path.endsWith('/offset'))).toBe(true);
      chart.destroy();
    });

    it('drags emit edits', () => {
      const onEdit = vi.fn();
      const { chart, annotation } = mount(textAnnotatedSpec, { onEdit });
      simulateDrag(annotation());
      expect(onEdit).toHaveBeenCalledTimes(1);
      chart.destroy();
    });

    it("warns once when interaction: 'edit' has no onEdit sink", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { chart, annotation } = mount(textAnnotatedSpec, { interaction: 'edit' });
      chart.resize();
      chart.update({ ...textAnnotatedSpec });
      const sinkWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('onEdit'));
      expect(sinkWarnings).toHaveLength(1);
      // Selection still works in edit mode.
      annotation().dispatchEvent(createMouseEvent('click', 100, 100));
      expect(chart.getSelectedElement()).toMatchObject({ type: 'annotation' });
      chart.destroy();
    });

    it('does not warn when onEdit is provided', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { chart } = mount(textAnnotatedSpec, { interaction: 'edit', onEdit: vi.fn() });
      expect(warn.mock.calls.some((c) => String(c[0]).includes('onEdit'))).toBe(false);
      chart.destroy();
    });
  });
});
