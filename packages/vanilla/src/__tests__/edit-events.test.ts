import type { ChartSpec, EditTransaction } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { encodePointerToken } from '../interactions/selection';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Shared specs
// ---------------------------------------------------------------------------

/**
 * Line chart with text annotation + connector, range, refline, chrome, legend,
 * and multi-series data (which produces series labels).
 */
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
    { type: 'range', x1: '2020-01-01', x2: '2021-01-01', label: 'Boom Period' },
    { type: 'refline', y: 30, label: 'Target' },
  ],
  chrome: {
    title: 'GDP Growth',
    subtitle: 'US vs UK over time',
    source: 'World Bank',
  },
};

/** Simple text annotation spec for focused annotation tests. */
const textAnnotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [
    { type: 'text', x: 10, y: 'A', text: 'Peak', offset: { dx: 10, dy: -20 }, connector: true },
  ],
};

/**
 * Two annotations whose `zIndex` REVERSES their spec order.
 *
 * The engine sorts `layout.annotations` by zIndex before handing them to the
 * renderer, so render position 0 here is spec annotation 1. Every other spec in
 * this file has exactly one annotation, which makes `index === specIndex`
 * trivially true and hides the difference entirely.
 */
const reorderedAnnotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [
    { type: 'text', x: 10, y: 'A', text: 'First in the spec', id: 'first', zIndex: 5 },
    { type: 'text', x: 30, y: 'C', text: 'Second in the spec', id: 'second', zIndex: 1 },
  ],
};

/**
 * Curved connector, which is the ONLY path that draws an arrowhead — and the only
 * one where edit mode has to find the connector's tip by parsing the arrowhead
 * polyline (`wireConnectorEndpointDrag`'s curved branch). Every other spec in this
 * file uses `connector: true` (straight, no arrow), so without this the arrowhead
 * selector and the tip-parsing code never execute in any test.
 */
const curvedAnnotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [
    {
      type: 'text',
      x: 10,
      y: 'A',
      text: 'Peak',
      offset: { dx: 40, dy: -50 },
      connector: 'curve',
    },
  ],
};

/** Range-only annotation spec. */
const rangeAnnotatedSpec: ChartSpec = {
  ...lineSpec,
  annotations: [
    {
      type: 'range',
      x1: '2020-01-01',
      x2: '2021-01-01',
      label: 'Boom Period',
      labelOffset: { dx: 5, dy: 3 },
    },
  ],
};

/** Refline-only annotation spec. */
const reflineAnnotatedSpec: ChartSpec = {
  ...lineSpec,
  annotations: [{ type: 'refline', y: 30, label: 'Target', labelOffset: { dx: 2, dy: -4 } }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate a drag sequence: mousedown -> mousemove -> mouseup.
 * Dispatches mousedown on the element, then mousemove/mouseup on document.
 */
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

describe('edit events', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // =========================================================================
  // 1. createDragHandler utility (tested through annotation drag)
  // =========================================================================
  describe('createDragHandler utility (via annotation drag)', () => {
    it('sets cursor:grab on the element', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      expect(annotation.style.cursor).toBe('grab');
      chart.destroy();
    });

    it('fires onEnd with correct dx/dy after drag', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      simulateDrag(annotation, 100, 100, 150, 130);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/offset'))).toBe(true);

      // Canonical placement converts the implicit diagonal anchor into explicit right.
      expect(valueAt<{ dx: number; dy: number }>(edit, '/offset').dx).toBe(60);
      expect(valueAt<{ dx: number; dy: number }>(edit, '/offset').dy).toBe(-18);
      expect(valueAt<string>(edit, '/anchor')).toBe('right');
      expect(valueAt<boolean>(edit, '/responsive')).toBe(false);
      // RFC 6901 path to the offset property
      expect(edit.ops.find((op) => op.path.endsWith('/offset'))?.path).toBe(
        '/annotations/0/offset',
      );

      chart.destroy();
    });

    it('does NOT fire onEnd when movement is below threshold (3px)', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      // Move less than 3px
      simulateDrag(annotation, 100, 100, 101, 101);

      expect(onEdit).not.toHaveBeenCalled();
      chart.destroy();
    });

    it('suppresses click event after real drag', () => {
      const onAnnotationClick = vi.fn();
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onAnnotationClick, onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      // Drag beyond threshold
      simulateDrag(annotation, 100, 100, 150, 130);

      // Fire a click right after drag
      annotation.dispatchEvent(createMouseEvent('click', 150, 130));

      expect(onEdit).toHaveBeenCalledTimes(1);
      // Click should be suppressed
      expect(onAnnotationClick).not.toHaveBeenCalled();

      chart.destroy();
    });

    it('sets cursor:grabbing during drag', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      annotation.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      // During drag (after mousedown, before mouseup) the cursor should be grabbing
      expect(annotation.style.cursor).toBe('grabbing');

      // Complete the drag to clean up
      document.dispatchEvent(createMouseEvent('mousemove', 120, 110));
      document.dispatchEvent(createMouseEvent('mouseup', 120, 110));

      // After drag, cursor should revert to grab
      expect(annotation.style.cursor).toBe('grab');

      chart.destroy();
    });

    it('cleanup function removes all listeners', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      chart.destroy();

      // After destroy, dispatching events should not fire the callback
      document.dispatchEvent(createMouseEvent('mousemove', 200, 200));
      document.dispatchEvent(createMouseEvent('mouseup', 200, 200));

      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. onEdit callback integration
  // =========================================================================
  describe('onEdit callback integration', () => {
    it('when onEdit is NOT provided, no grab cursors appear on chrome/legend/labels', () => {
      // Mount without onEdit
      const chart = createChart(container, fullEditSpec, {});

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

      // Series labels should not have grab cursor
      const seriesLabels = container.querySelectorAll('.oc-mark-label');
      for (const el of seriesLabels) {
        expect((el as HTMLElement).style.cursor).not.toBe('grab');
      }

      chart.destroy();
    });

    it('when onEdit IS provided, grab cursors appear on editable elements', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit });

      // Chrome elements should have grab cursor
      const chromeTexts = container.querySelectorAll('.oc-chrome text[data-chrome-key]');
      for (const el of chromeTexts) {
        expect((el as HTMLElement).style.cursor).toBe('grab');
      }

      // Legend should have grab cursor (if present)
      const legendG = container.querySelector('.oc-legend') as SVGGElement | null;
      if (legendG) {
        expect(legendG.style.cursor).toBe('grab');
      }

      chart.destroy();
    });

    it('dragging a text annotation fires only onEdit when only onEdit is provided', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      simulateDrag(annotation, 100, 100, 150, 130);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/offset'))).toBe(true);

      chart.destroy();
    });
  });

  // =========================================================================
  // 3. wireAnnotationLabelDrag (range/refline)
  // =========================================================================
  describe('wireAnnotationLabelDrag', () => {
    it('range annotation labels get cursor:grab when onEdit is provided', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, rangeAnnotatedSpec, { onEdit });

      const rangeLabel = container.querySelector(
        '.oc-annotation-range .oc-annotation-label',
      ) as SVGTextElement | null;
      if (!rangeLabel) {
        // Range may not render a visible label in test env
        chart.destroy();
        return;
      }

      expect(rangeLabel.style.cursor).toBe('grab');
      chart.destroy();
    });

    it('dragging a range label fires onEdit with type range-label and accumulated labelOffset', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, rangeAnnotatedSpec, { onEdit });

      const rangeLabel = container.querySelector(
        '.oc-annotation-range .oc-annotation-label',
      ) as SVGTextElement | null;
      if (!rangeLabel) {
        chart.destroy();
        return;
      }

      simulateDrag(rangeLabel, 100, 100, 140, 120);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/labelOffset'))).toBe(true);

      expect(edit.ops[0].expect?.type).toBe('range');
      // Original labelOffset (5, 3) + drag delta (40, 20) = (45, 23)
      expect(valueAt<{ dx: number; dy: number }>(edit, '/labelOffset').dx).toBe(45);
      expect(valueAt<{ dx: number; dy: number }>(edit, '/labelOffset').dy).toBe(23);
      expect(edit.ops.find((op) => op.path.endsWith('/labelOffset'))?.path).toBe(
        '/annotations/0/labelOffset',
      );

      chart.destroy();
    });

    it('refline annotation labels get cursor:grab when onEdit is provided', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, reflineAnnotatedSpec, { onEdit });

      const reflineLabel = container.querySelector(
        '.oc-annotation-refline .oc-annotation-label',
      ) as SVGTextElement | null;
      if (!reflineLabel) {
        chart.destroy();
        return;
      }

      expect(reflineLabel.style.cursor).toBe('grab');
      chart.destroy();
    });

    it('dragging a refline label fires onEdit with type refline-label and accumulated labelOffset', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, reflineAnnotatedSpec, { onEdit });

      const reflineLabel = container.querySelector(
        '.oc-annotation-refline .oc-annotation-label',
      ) as SVGTextElement | null;
      if (!reflineLabel) {
        chart.destroy();
        return;
      }

      simulateDrag(reflineLabel, 100, 100, 130, 115);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/labelOffset'))).toBe(true);

      expect(edit.ops[0].expect?.type).toBe('refline');
      // Original labelOffset (2, -4) + drag delta (30, 15) = (32, 11)
      expect(valueAt<{ dx: number; dy: number }>(edit, '/labelOffset').dx).toBe(32);
      expect(valueAt<{ dx: number; dy: number }>(edit, '/labelOffset').dy).toBe(11);
      expect(edit.ops.find((op) => op.path.endsWith('/labelOffset'))?.path).toBe(
        '/annotations/0/labelOffset',
      );

      chart.destroy();
    });
  });

  // =========================================================================
  // 4. wireChromeDrag
  // =========================================================================
  describe('wireChromeDrag', () => {
    it('chrome text elements get cursor:grab when onEdit is provided', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit });

      const chromeTexts = container.querySelectorAll('.oc-chrome text[data-chrome-key]');
      expect(chromeTexts.length).toBeGreaterThan(0);

      for (const el of chromeTexts) {
        expect((el as HTMLElement).style.cursor).toBe('grab');
      }

      chart.destroy();
    });

    it('dragging a chrome element fires onEdit with type chrome, correct key, text, and accumulated offset', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit });

      const titleEl = container.querySelector(
        '.oc-chrome text[data-chrome-key="title"]',
      ) as SVGTextElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateDrag(titleEl, 100, 100, 130, 115);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/chrome/title'))).toBe(true);

      expect(edit.ops[0].path).toBe('/chrome/title');
      expect(valueAt<{ text: string }>(edit, '/chrome/title').text).toBeTruthy();
      // No existing offset, so offset = delta (30, 15)
      expect(
        valueAt<{ offset: { dx: number; dy: number }; text: string }>(edit, '/chrome/title').offset
          .dx,
      ).toBe(30);
      expect(
        valueAt<{ offset: { dx: number; dy: number }; text: string }>(edit, '/chrome/title').offset
          .dy,
      ).toBe(15);

      chart.destroy();
    });
  });

  // =========================================================================
  // 5. wireLegendDrag
  // =========================================================================
  describe('wireLegendDrag', () => {
    it('legend group gets cursor:grab when onEdit is provided', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit });

      const legendG = container.querySelector('.oc-legend') as SVGGElement | null;
      if (!legendG) {
        chart.destroy();
        return;
      }

      expect(legendG.style.cursor).toBe('grab');
      chart.destroy();
    });

    it('dragging legend fires onEdit with type legend and accumulated offset', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit });

      const legendG = container.querySelector('.oc-legend') as SVGGElement | null;
      if (!legendG) {
        chart.destroy();
        return;
      }

      simulateDrag(legendG, 200, 50, 250, 70);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/legend'))).toBe(true);

      expect(valueAt<{ offset: { dx: number; dy: number } }>(edit, '/legend').offset.dx).toBe(50);
      expect(valueAt<{ offset: { dx: number; dy: number } }>(edit, '/legend').offset.dy).toBe(20);

      chart.destroy();
    });

    it('click event after drag is suppressed (does not fire onLegendToggle)', () => {
      const onLegendToggle = vi.fn();
      const onEdit = vi.fn();
      const chart = createChart(container, fullEditSpec, { onLegendToggle, onEdit });

      const legendG = container.querySelector('.oc-legend') as SVGGElement | null;
      if (!legendG) {
        chart.destroy();
        return;
      }

      // Drag the legend
      simulateDrag(legendG, 200, 50, 250, 70);

      // Fire a click after drag
      legendG.dispatchEvent(createMouseEvent('click', 250, 70));

      expect(onEdit).toHaveBeenCalledTimes(1);
      // Click should have been suppressed by the drag handler
      expect(onLegendToggle).not.toHaveBeenCalled();

      chart.destroy();
    });
  });

  // =========================================================================
  // 6. wireConnectorEndpointDrag
  // =========================================================================
  describe('wireConnectorEndpointDrag', () => {
    it('connector handles are created dynamically when onEdit is provided', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      // Check that connector handles exist within the annotation group
      const handles = annotationG.querySelectorAll('.oc-connector-handle');
      // There should be 2 handles (from and to) if a connector is present
      const connector = annotationG.querySelector('.oc-annotation-connector');
      if (connector) {
        expect(handles.length).toBe(2);
        // Verify they have the correct data-endpoint attributes
        const endpoints = Array.from(handles).map((h) => h.getAttribute('data-endpoint'));
        expect(endpoints).toContain('from');
        expect(endpoints).toContain('to');
      }

      chart.destroy();
    });

    it('handles appear on mouseenter of annotation group', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const handles = annotationG.querySelectorAll('.oc-connector-handle');
      if (handles.length === 0) {
        chart.destroy();
        return;
      }

      // Initially handles should be invisible (opacity: 0)
      for (const h of handles) {
        expect(h.getAttribute('opacity')).toBe('0');
      }

      // Trigger mouseenter on the annotation group
      annotationG.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Now handles should be visible
      for (const h of handles) {
        expect(h.getAttribute('opacity')).toBe('0.6');
      }

      chart.destroy();
    });

    it('handles disappear on mouseleave', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const handles = annotationG.querySelectorAll('.oc-connector-handle');
      if (handles.length === 0) {
        chart.destroy();
        return;
      }

      // Show handles first
      annotationG.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      // Then hide them
      annotationG.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      for (const h of handles) {
        expect(h.getAttribute('opacity')).toBe('0');
      }

      chart.destroy();
    });

    it('dragging a handle fires onEdit with type annotation-connector and correct endpoint/offset', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      // Find the "from" handle
      const fromHandle = annotationG.querySelector(
        '.oc-connector-handle[data-endpoint="from"]',
      ) as SVGCircleElement | null;

      if (!fromHandle) {
        chart.destroy();
        return;
      }

      simulateDrag(fromHandle, 100, 100, 130, 115);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/connectorOffset'))).toBe(true);

      expect(
        valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').from,
      ).toBeDefined();
      expect(edit.ops[0].expect?.type).toBe('text');
      // No existing connectorOffset, so offset = delta (30, 15)
      expect(
        valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').from.dx,
      ).toBe(30);
      expect(
        valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').from.dy,
      ).toBe(15);
      expect(edit.ops.find((op) => op.path.endsWith('/connectorOffset'))?.path).toBe(
        '/annotations/0/connectorOffset',
      );

      chart.destroy();
    });

    it('a "from" handle drag takes EFFECT: writing the fired offset back to the spec moves the connector', () => {
      // The roundtrip the other handle tests skip: host receives the edit, writes
      // `connectorOffset.from` into the spec, calls update() -- and the connector
      // origin must actually move by the dragged delta. Auto-placed on purpose:
      // Pass 2 moves every auto annotation, which is exactly the path that used to
      // drop the offset on the floor.
      const onEdit = vi.fn();
      const autoAnnotatedSpec: ChartSpec = {
        ...barSpec,
        annotations: [{ type: 'text', x: 10, y: 'A', text: 'Peak', connector: true }],
      };
      const chart = createChart(container, autoAnnotatedSpec, { onEdit });

      const before = chart.layout.annotations?.[0]?.label?.connector?.from;
      expect(before).toBeTruthy();
      const beforeX = before!.x;
      const beforeY = before!.y;

      const fromHandle = container.querySelector(
        '.oc-connector-handle[data-endpoint="from"]',
      ) as SVGCircleElement | null;
      expect(fromHandle).toBeTruthy();

      simulateDrag(fromHandle!, 100, 100, 130, 118);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/connectorOffset'))).toBe(true);
      expect(
        valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').from,
      ).toBeDefined();

      // Host writes the edit back to the spec and re-renders.
      chart.update({
        ...autoAnnotatedSpec,
        annotations: [
          {
            ...autoAnnotatedSpec.annotations![0],
            connectorOffset: {
              from: valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset')
                .from,
            },
          },
        ],
      } as ChartSpec);

      const after = chart.layout.annotations?.[0]?.label?.connector?.from;
      expect(after).toBeTruthy();
      // Moved by the dragged delta (30, 18), within half a pixel.
      expect(after!.x - beforeX).toBeCloseTo(30, 0);
      expect(after!.y - beforeY).toBeCloseTo(18, 0);

      chart.destroy();
    });

    it('dragging the "to" handle fires onEdit with endpoint "to"', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const toHandle = annotationG.querySelector(
        '.oc-connector-handle[data-endpoint="to"]',
      ) as SVGCircleElement | null;

      if (!toHandle) {
        chart.destroy();
        return;
      }

      simulateDrag(toHandle, 100, 100, 140, 125);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/connectorOffset'))).toBe(true);

      expect(
        valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').to,
      ).toBeDefined();
      expect(edit.ops.find((op) => op.path.endsWith('/connectorOffset'))?.path).toBe(
        '/annotations/0/connectorOffset',
      );

      chart.destroy();
    });

    // The engine sorts annotations by zIndex, so the order the renderer draws them
    // in is NOT the order they appear in the spec. Edit mode maps a dragged label
    // back to its spec annotation, and if it maps by render position it edits the
    // wrong one -- you drag one callout and a different one jumps.
    describe('drags map to the right spec annotation, whatever the render order', () => {
      it('drags the annotation you grabbed, not the one that shares its slot', () => {
        const onEdit = vi.fn();
        const chart = createChart(container, reorderedAnnotatedSpec, { onEdit });

        // Grab by identity, not by position: this is the one the user clicked.
        const secondG = container.querySelector(
          '.oc-annotation-text[data-annotation-id="second"]',
        ) as SVGGElement;
        expect(secondG).toBeTruthy();

        simulateDrag(secondG, 100, 100, 120, 110);

        expect(onEdit).toHaveBeenCalledTimes(1);
        const edit: EditTransaction = onEdit.mock.calls[0][0];
        expect(edit.ops.some((op) => op.path.endsWith('/offset'))).toBe(true);

        // The edit must carry the annotation whose label was actually dragged.
        // Pre-fix this returned the *other* one (zIndex had swapped their slots).
        expect(edit.ops[0].expect?.id).toBe('second');

        chart.destroy();
      });

      it('each label carries the index of its own spec annotation', () => {
        const chart = createChart(container, reorderedAnnotatedSpec, { onEdit: vi.fn() });

        const groups = Array.from(
          container.querySelectorAll('.oc-annotation-text'),
        ) as SVGGElement[];
        expect(groups).toHaveLength(2);

        for (const g of groups) {
          const id = g.getAttribute('data-annotation-id');
          const index = Number(g.getAttribute('data-annotation-index'));
          const expected = reorderedAnnotatedSpec.annotations!.findIndex(
            (a) => 'id' in a && a.id === id,
          );
          expect(index).toBe(expected);
        }

        chart.destroy();
      });
    });

    // A curved connector has no <line> to read x2/y2 from, so edit mode recovers
    // the tip by parsing the arrowhead polyline (`polyline.oc-annotation-arrowhead`,
    // whose middle point is the tip). If that selector ever stops matching what the
    // renderer emits, `querySelector` returns null, the tip silently falls back to
    // (0, 0), and the "to" handle jumps to the SVG origin. Nothing else in this file
    // renders an arrowed connector, so these are the only tests that can catch it.
    describe('curved connector (the arrowhead-tip path)', () => {
      it('renders exactly one arrowhead polyline that edit mode can find', () => {
        const chart = createChart(container, curvedAnnotatedSpec, { onEdit: vi.fn() });

        const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement;
        expect(annotationG).toBeTruthy();
        // The path the renderer draws...
        expect(annotationG.querySelector('path.oc-annotation-connector')).toBeTruthy();
        // ...and the exact selector the drag code uses to find its tip.
        const arrowheads = annotationG.querySelectorAll('polyline.oc-annotation-arrowhead');
        expect(arrowheads).toHaveLength(1);

        chart.destroy();
      });

      it('puts the "to" handle on the arrowhead tip, not at the origin', () => {
        const chart = createChart(container, curvedAnnotatedSpec, { onEdit: vi.fn() });

        const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement;
        const arrowhead = annotationG.querySelector(
          'polyline.oc-annotation-arrowhead',
        ) as SVGPolylineElement;
        const toHandle = annotationG.querySelector(
          '.oc-connector-handle[data-endpoint="to"]',
        ) as SVGCircleElement;
        expect(toHandle).toBeTruthy();

        // "baseLeft tip baseRight" -- the tip is the middle point.
        const [tipX, tipY] = (arrowhead.getAttribute('points')?.split(' ')[1] ?? '').split(',');
        expect(Number(tipX)).toBeGreaterThan(0);

        expect(Number(toHandle.getAttribute('cx'))).toBeCloseTo(Number(tipX), 3);
        expect(Number(toHandle.getAttribute('cy'))).toBeCloseTo(Number(tipY), 3);

        chart.destroy();
      });

      it('dragging the "to" handle of a curved connector fires a real edit', () => {
        const onEdit = vi.fn();
        const chart = createChart(container, curvedAnnotatedSpec, { onEdit });

        const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement;
        const toHandle = annotationG.querySelector(
          '.oc-connector-handle[data-endpoint="to"]',
        ) as SVGCircleElement;
        expect(toHandle).toBeTruthy();

        simulateDrag(toHandle, 100, 100, 130, 115);

        expect(onEdit).toHaveBeenCalledTimes(1);
        const edit: EditTransaction = onEdit.mock.calls[0][0];
        expect(edit.ops.some((op) => op.path.endsWith('/connectorOffset'))).toBe(true);

        expect(
          valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').to,
        ).toBeDefined();
        expect(
          valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').to.dx,
        ).toBe(30);
        expect(
          valueAt<Record<string, { dx: number; dy: number }>>(edit, '/connectorOffset').to.dy,
        ).toBe(15);

        chart.destroy();
      });
    });
  });

  // =========================================================================
  // 7. legend-toggle onEdit payload
  // =========================================================================
  describe('transient legend visibility', () => {
    it('reports visibility through onLegendToggle without a durable transaction', () => {
      const onEdit = vi.fn();
      const onLegendToggle = vi.fn();
      const chart = createChart(
        container,
        { ...lineSpec, legend: { show: true, position: 'top' } },
        { onEdit, onLegendToggle },
      );
      const entry = container.querySelector(
        '.oc-legend:not(.oc-legend--size) [data-legend-index]',
      )!;
      expect(entry).not.toBeNull();
      const series = entry.getAttribute('data-legend-label')!;
      entry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onLegendToggle).toHaveBeenLastCalledWith(series, false);
      container
        .querySelector(`[data-legend-label="${series}"]`)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onLegendToggle).toHaveBeenLastCalledWith(series, true);
      expect(onEdit).not.toHaveBeenCalled();
      chart.destroy();
    });
  });

  // =========================================================================
  // 8. Spec-pointer paths on edit events (RFC 6901)
  // =========================================================================
  describe('spec-pointer paths (RFC 6901)', () => {
    it('delete edit carries path from buildElementRef', () => {
      const onEdit = vi.fn();
      const onSelect = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit, onSelect });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      annotation.dispatchEvent(createMouseEvent('click', 100, 100));
      expect(onSelect).toHaveBeenCalled();

      const svg = container.querySelector('svg')!;
      svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

      const deleteCall = onEdit.mock.calls.find((call: [EditTransaction]) =>
        call[0].ops.some((op) => op.op === 'remove'),
      );
      expect(deleteCall).toBeDefined();
      const edit: EditTransaction = deleteCall![0];
      expect(edit.ops.some((op) => op.op === 'remove')).toBe(true);

      expect(edit.ops.find((op) => op.path.endsWith('/annotations/0'))?.path).toBe(
        '/annotations/0',
      );

      chart.destroy();
    });

    it('select annotation carries path from buildElementRef', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit: vi.fn(), onSelect });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      annotation.dispatchEvent(createMouseEvent('click', 100, 100));
      expect(onSelect).toHaveBeenCalled();

      const ref = onSelect.mock.calls[0][0];
      expect(ref.type).toBe('annotation');
      if (ref.type === 'annotation') {
        expect(ref.path).toBe('/annotations/0');
      }

      chart.destroy();
    });

    it('buildElementRef produces /chrome/<key> path for chrome elements', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit: vi.fn(), onSelect });

      const titleEl = container.querySelector(
        '.oc-chrome text[data-chrome-key="title"]',
      ) as SVGTextElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      titleEl.dispatchEvent(createMouseEvent('click', 100, 100));
      expect(onSelect).toHaveBeenCalled();

      const ref = onSelect.mock.calls[0][0];
      expect(ref.type).toBe('chrome');
      if (ref.type === 'chrome') {
        expect(ref.path).toBe('/chrome/title');
      }

      chart.destroy();
    });

    it('buildElementRef produces /legend path for legend clicks', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, fullEditSpec, { onEdit: vi.fn(), onSelect });

      const legendG = container.querySelector('.oc-legend') as SVGGElement | null;
      if (!legendG) {
        chart.destroy();
        return;
      }

      legendG.dispatchEvent(createMouseEvent('click', 200, 50));
      expect(onSelect).toHaveBeenCalled();

      const ref = onSelect.mock.calls[0][0];
      expect(ref.type).toBe('legend');
      if (ref.type === 'legend') {
        expect(ref.path).toBe('/legend');
      }

      chart.destroy();
    });

    it('curved connector drag includes connectorOffset path', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, curvedAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement;
      const toHandle = annotationG?.querySelector(
        '.oc-connector-handle[data-endpoint="to"]',
      ) as SVGCircleElement;
      if (!toHandle) {
        chart.destroy();
        return;
      }

      simulateDrag(toHandle, 100, 100, 130, 115);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];

      expect(edit.ops.find((op) => op.path.endsWith('/connectorOffset'))?.path).toBe(
        '/annotations/0/connectorOffset',
      );

      chart.destroy();
    });
  });

  // =========================================================================
  // 9. RFC 6901 token escaping
  // =========================================================================
  describe('RFC 6901 token escaping', () => {
    it('encodePointerToken escapes ~ and / per RFC 6901', () => {
      expect(encodePointerToken('US/UK')).toBe('US~1UK');
      expect(encodePointerToken('A~B')).toBe('A~0B');
      expect(encodePointerToken('a~b/c')).toBe('a~0b~1c');
      expect(encodePointerToken('plain')).toBe('plain');
    });
  });

  // =========================================================================
  // 10. wireSeriesLabelDrag
  // =========================================================================

  // =========================================================================
  // 8. element field on annotation edit payloads
  // =========================================================================
  describe('element field on annotation edit payloads', () => {
    it('keeps first-leaf drag pointers canonical', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, { layer: [textAnnotatedSpec] }, { onEdit });
      const annotation = container.querySelector('.oc-annotation-text');
      expect(annotation).not.toBeNull();
      simulateDrag(annotation!, 100, 100, 150, 130);
      expect(onEdit.mock.calls[0][0].ops.map((op: { path: string }) => op.path)).toEqual([
        '/layer/0/annotations/0/anchor',
        '/layer/0/annotations/0/offset',
        '/layer/0/annotations/0/responsive',
      ]);
      chart.destroy();
    });

    it('text annotation drag includes element with index', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      simulateDrag(annotation, 100, 100, 150, 130);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/offset'))).toBe(true);

      expect(edit.ops[0].path).toMatch(/^\/annotations\/0\//);
      expect(edit.ops.find((op) => op.path.endsWith('/offset'))?.path).toBe(
        '/annotations/0/offset',
      );

      chart.destroy();
    });

    it('text annotation drag includes element with id when annotation has id', () => {
      const specWithId: ChartSpec = {
        ...barSpec,
        annotations: [
          {
            type: 'text',
            x: 10,
            y: 'A',
            text: 'Peak',
            id: 'test-id',
            offset: { dx: 10, dy: -20 },
            connector: true,
          },
        ],
      };
      const onEdit = vi.fn();
      const chart = createChart(container, specWithId, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      simulateDrag(annotation, 100, 100, 150, 130);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/offset'))).toBe(true);

      expect(edit.ops[0].expect?.id).toBe('test-id');

      chart.destroy();
    });

    it('text annotation drag element.id is undefined when annotation has no id', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotation = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      simulateDrag(annotation, 100, 100, 150, 130);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/offset'))).toBe(true);

      expect(edit.ops[0].expect?.id).toBeUndefined();

      chart.destroy();
    });

    it('connector endpoint drag includes element', () => {
      const specWithId: ChartSpec = {
        ...barSpec,
        annotations: [
          {
            type: 'text',
            x: 10,
            y: 'A',
            text: 'Peak',
            id: 'conn-id',
            offset: { dx: 10, dy: -20 },
            connector: true,
          },
        ],
      };
      const onEdit = vi.fn();
      const chart = createChart(container, specWithId, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const fromHandle = annotationG.querySelector(
        '.oc-connector-handle[data-endpoint="from"]',
      ) as SVGCircleElement | null;

      if (!fromHandle) {
        chart.destroy();
        return;
      }

      simulateDrag(fromHandle, 100, 100, 130, 115);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/connectorOffset'))).toBe(true);

      expect(edit.ops[0].path).toMatch(/^\/annotations\/0\//);
      expect(edit.ops[0].expect?.id).toBe('conn-id');
      expect(edit.ops.find((op) => op.path.endsWith('/connectorOffset'))?.path).toBe(
        '/annotations/0/connectorOffset',
      );

      chart.destroy();
    });

    it('range-label drag includes element', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, rangeAnnotatedSpec, { onEdit });

      const rangeLabel = container.querySelector(
        '.oc-annotation-range .oc-annotation-label',
      ) as SVGTextElement | null;
      if (!rangeLabel) {
        chart.destroy();
        return;
      }

      simulateDrag(rangeLabel, 100, 100, 140, 120);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/labelOffset'))).toBe(true);

      expect(edit.ops[0].path).toMatch(/^\/annotations\//);

      expect(edit.ops[0].path).toMatch(/^\/annotations\/0\//);

      chart.destroy();
    });

    it('refline-label drag includes element', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, reflineAnnotatedSpec, { onEdit });

      const reflineLabel = container.querySelector(
        '.oc-annotation-refline .oc-annotation-label',
      ) as SVGTextElement | null;
      if (!reflineLabel) {
        chart.destroy();
        return;
      }

      simulateDrag(reflineLabel, 100, 100, 130, 115);

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: EditTransaction = onEdit.mock.calls[0][0];
      expect(edit.ops.some((op) => op.path.endsWith('/labelOffset'))).toBe(true);

      expect(edit.ops[0].path).toMatch(/^\/annotations\//);

      expect(edit.ops[0].path).toMatch(/^\/annotations\/0\//);

      chart.destroy();
    });
  });

  // =========================================================================
  // 9. wireAnchorDrag
  // =========================================================================
  describe('wireAnchorDrag', () => {
    it('anchor handle is created when onEdit is provided and annotation has a dot', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const handle = annotationG.querySelector('.oc-anchor-handle');
      if (handle) {
        expect(handle.getAttribute('r')).toBe('4');
        expect(handle.getAttribute('opacity')).toBe('0');
      }

      chart.destroy();
    });

    it('anchor handle shows on mouseenter, hides on mouseleave', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const handle = annotationG.querySelector('.oc-anchor-handle');
      if (!handle) {
        chart.destroy();
        return;
      }

      expect(handle.getAttribute('opacity')).toBe('0');

      annotationG.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(handle.getAttribute('opacity')).toBe('0.6');

      annotationG.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      expect(handle.getAttribute('opacity')).toBe('0');

      chart.destroy();
    });

    it('dragging anchor handle fires onEdit with type annotation-anchor', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, textAnnotatedSpec, { onEdit });

      const annotationG = container.querySelector('.oc-annotation-text') as SVGGElement | null;
      if (!annotationG) {
        chart.destroy();
        return;
      }

      const handle = annotationG.querySelector('.oc-anchor-handle') as SVGCircleElement | null;
      if (!handle) {
        chart.destroy();
        return;
      }

      const cx = Number(handle.getAttribute('cx'));
      const cy = Number(handle.getAttribute('cy'));
      simulateDrag(handle, cx, cy, cx + 30, cy + 20);

      const anchorCall = onEdit.mock.calls.find((call: [EditTransaction]) =>
        call[0].ops.some((op) => op.path.endsWith('/x')),
      );
      expect(anchorCall).toBeDefined();
      const edit: EditTransaction = anchorCall![0];
      expect(edit.ops.some((op) => op.path.endsWith('/x'))).toBe(true);

      expect(edit.ops[0].expect).toBeDefined();
      expect(edit.ops[0].path).toMatch(/^\/annotations\//);
      expect(valueAt(edit, '/x')).toBeDefined();
      expect(valueAt(edit, '/y')).toBeDefined();

      chart.destroy();
    });
  });
});

function valueAt<T>(tx: EditTransaction, suffix: string): T {
  const op = tx.ops.find((op) => op.path.endsWith(suffix));
  expect(op, `transaction operation ending in ${suffix}`).toBeDefined();
  return op!.value as T;
}
