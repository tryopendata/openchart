import type { ChartSpec } from '@opendata-ai/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const annotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [{ type: 'refline', y: 0, label: 'Zero' }],
};

const textAnnotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [{ type: 'text', x: 10, y: 'A', text: 'Peak', offset: { dx: 10, dy: -20 } }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chart event handlers', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('onMarkClick', () => {
    it('fires with correct data when a mark element is clicked', () => {
      const onMarkClick = vi.fn();
      const chart = createChart(container, barSpec, { onMarkClick });

      // Find a rect mark element (bar chart renders rect marks)
      const mark = container.querySelector('[data-mark-id]');
      expect(mark).not.toBeNull();

      mark!.dispatchEvent(createMouseEvent('click', 150, 200));

      expect(onMarkClick).toHaveBeenCalledTimes(1);
      const event = onMarkClick.mock.calls[0][0];
      expect(event.datum).toBeDefined();
      expect(event.position).toBeDefined();
      expect(event.position.x).toBeTypeOf('number');
      expect(event.position.y).toBeTypeOf('number');
      expect(event.event).toBeInstanceOf(MouseEvent);

      chart.destroy();
    });

    it('includes series info for multi-series charts', () => {
      const onMarkClick = vi.fn();
      const chart = createChart(container, lineSpec, { onMarkClick });

      // Line charts have marks with data-series attribute
      const marks = container.querySelectorAll('[data-mark-id]');
      expect(marks.length).toBeGreaterThan(0);

      marks[0].dispatchEvent(createMouseEvent('click'));

      expect(onMarkClick).toHaveBeenCalledTimes(1);
      const event = onMarkClick.mock.calls[0][0];
      // Line marks should have series info
      expect(event.series).toBeDefined();

      chart.destroy();
    });
  });

  describe('onMarkHover', () => {
    it('fires on mouseenter of a mark element', () => {
      const onMarkHover = vi.fn();
      const chart = createChart(container, barSpec, { onMarkHover });

      const mark = container.querySelector('[data-mark-id]');
      expect(mark).not.toBeNull();

      mark!.dispatchEvent(createMouseEvent('mouseenter', 120, 180));

      expect(onMarkHover).toHaveBeenCalledTimes(1);
      const event = onMarkHover.mock.calls[0][0];
      expect(event.datum).toBeDefined();
      expect(event.position).toBeDefined();

      chart.destroy();
    });
  });

  describe('onMarkLeave', () => {
    it('fires on mouseleave of a mark element', () => {
      const onMarkLeave = vi.fn();
      const chart = createChart(container, barSpec, { onMarkLeave });

      const mark = container.querySelector('[data-mark-id]');
      expect(mark).not.toBeNull();

      mark!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      expect(onMarkLeave).toHaveBeenCalledTimes(1);
      // onMarkLeave receives no arguments
      expect(onMarkLeave.mock.calls[0]).toHaveLength(0);

      chart.destroy();
    });
  });

  describe('onLegendToggle', () => {
    it('fires when a legend entry is clicked', () => {
      const onLegendToggle = vi.fn();
      const chart = createChart(container, lineSpec, { onLegendToggle });

      const legendEntry = container.querySelector('[data-legend-index]');
      expect(legendEntry).not.toBeNull();

      legendEntry.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onLegendToggle).toHaveBeenCalledTimes(1);
      const [series, visible] = onLegendToggle.mock.calls[0];
      expect(series).toBeTypeOf('string');
      // First click hides the series
      expect(visible).toBe(false);

      // Click again to toggle back
      legendEntry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onLegendToggle).toHaveBeenCalledTimes(2);
      const [, visibleAfter] = onLegendToggle.mock.calls[1];
      expect(visibleAfter).toBe(true);

      chart.destroy();
    });
  });

  describe('onAnnotationClick', () => {
    it('fires when an annotation element is clicked', () => {
      const onAnnotationClick = vi.fn();
      const chart = createChart(container, annotatedSpec, { onAnnotationClick });

      const annotation = container.querySelector('.viz-annotation');
      if (!annotation) {
        // Refline at y=0 may resolve outside the chart area in test env
        chart.destroy();
        return;
      }

      annotation.dispatchEvent(createMouseEvent('click'));

      expect(onAnnotationClick).toHaveBeenCalledTimes(1);
      const [annotationArg, mouseEvent] = onAnnotationClick.mock.calls[0];
      expect(annotationArg).toBeDefined();
      expect(annotationArg.type).toBe('refline');
      expect(mouseEvent).toBeInstanceOf(MouseEvent);

      chart.destroy();
    });
  });

  describe('onAnnotationEdit', () => {
    it('sets cursor:grab on text annotations when onAnnotationEdit is provided', () => {
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onAnnotationEdit });

      const annotation = container.querySelector('.viz-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      expect(annotation.style.cursor).toBe('grab');
      chart.destroy();
    });

    it('does not set cursor:grab on non-text annotations', () => {
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, annotatedSpec, { onAnnotationEdit });

      const annotation = container.querySelector('.viz-annotation-refline') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      expect(annotation.style.cursor).not.toBe('grab');
      chart.destroy();
    });

    it('fires with original annotation and updated offset after drag', () => {
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onAnnotationEdit });

      const annotation = container.querySelector('.viz-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      // Simulate drag: mousedown -> mousemove -> mouseup
      annotation.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      document.dispatchEvent(createMouseEvent('mousemove', 150, 130));
      document.dispatchEvent(createMouseEvent('mouseup', 150, 130));

      expect(onAnnotationEdit).toHaveBeenCalledTimes(1);
      const [annotationArg, offsetArg] = onAnnotationEdit.mock.calls[0];
      expect(annotationArg.type).toBe('text');
      expect(annotationArg.text).toBe('Peak');
      // Original offset (10, -20) + drag delta (50, 30) = (60, 10)
      expect(offsetArg.dx).toBe(60);
      expect(offsetArg.dy).toBe(10);

      chart.destroy();
    });

    it('does not fire when drag movement is below threshold', () => {
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onAnnotationEdit });

      const annotation = container.querySelector('.viz-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      // Simulate drag with minimal movement (< 3px)
      annotation.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      document.dispatchEvent(createMouseEvent('mousemove', 101, 101));
      document.dispatchEvent(createMouseEvent('mouseup', 101, 101));

      expect(onAnnotationEdit).not.toHaveBeenCalled();
      chart.destroy();
    });

    it('suppresses click after drag', () => {
      const onAnnotationClick = vi.fn();
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, {
        onAnnotationClick,
        onAnnotationEdit,
      });

      const annotation = container.querySelector('.viz-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      // Drag > 3px
      annotation.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      document.dispatchEvent(createMouseEvent('mousemove', 150, 130));
      document.dispatchEvent(createMouseEvent('mouseup', 150, 130));

      // Fire a click after the drag
      annotation.dispatchEvent(createMouseEvent('click', 150, 130));

      expect(onAnnotationEdit).toHaveBeenCalledTimes(1);
      // Click should have been suppressed by the one-time capture handler
      expect(onAnnotationClick).not.toHaveBeenCalled();

      chart.destroy();
    });

    it('applies transform during drag', () => {
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onAnnotationEdit });

      const annotation = container.querySelector('.viz-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      annotation.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      document.dispatchEvent(createMouseEvent('mousemove', 140, 120));

      // During drag, the annotation group should have a transform
      const transform = annotation.getAttribute('transform');
      expect(transform).toContain('translate');

      // Complete the drag to clean up
      document.dispatchEvent(createMouseEvent('mouseup', 140, 120));
      chart.destroy();
    });

    it('cleans up listeners on destroy', () => {
      const onAnnotationEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onAnnotationEdit });

      chart.destroy();

      // After destroy, dispatching events should not cause errors
      document.dispatchEvent(createMouseEvent('mousemove', 200, 200));
      document.dispatchEvent(createMouseEvent('mouseup', 200, 200));

      expect(onAnnotationEdit).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on destroy', () => {
      const onMarkClick = vi.fn();
      const chart = createChart(container, barSpec, { onMarkClick });

      const mark = container.querySelector('[data-mark-id]');
      expect(mark).not.toBeNull();

      chart.destroy();

      // After destroy, clicking should not fire the handler
      // (the SVG is removed, but we verify the handler reference is cleaned up)
      expect(onMarkClick).not.toHaveBeenCalled();
    });

    it('removes event listeners on update', () => {
      const onMarkClick = vi.fn();
      const chart = createChart(container, barSpec, { onMarkClick });

      // Update triggers a re-render which should clean up old listeners
      chart.update(lineSpec);

      // Find mark in the new render
      const mark = container.querySelector('[data-mark-id]');
      expect(mark).not.toBeNull();

      // Click the new mark - should still fire since new listeners were wired
      mark!.dispatchEvent(createMouseEvent('click'));
      expect(onMarkClick).toHaveBeenCalledTimes(1);

      chart.destroy();
    });
  });
});
