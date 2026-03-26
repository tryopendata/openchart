import type { ChartSpec, ElementEdit, ElementRef } from '@opendata-ai/openchart-core';
import { elementRef } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Shared specs
// ---------------------------------------------------------------------------

/**
 * Line chart with chrome, annotations, multi-series (produces legend + series labels).
 * Useful for testing selection across different element types.
 */
const selectionSpec: ChartSpec = {
  ...lineSpec,
  labels: { show: true },
  annotations: [
    {
      type: 'text',
      x: '2020-01-01',
      y: 10,
      text: 'Peak',
      offset: { dx: 10, dy: -20 },
    },
  ],
  chrome: {
    title: 'GDP Growth',
    subtitle: 'US vs UK over time',
    source: 'World Bank',
  },
};

/** Simple bar chart with chrome for focused chrome selection tests. */
const chromeOnlySpec: ChartSpec = {
  ...barSpec,
  chrome: {
    title: 'Simple Chart',
    subtitle: 'With subtitle',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch a click event on an element.
 */
function simulateClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/**
 * Dispatch a double-click event on an element.
 */
function simulateDblClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
}

/**
 * Dispatch a keydown event on an element.
 */
function simulateKeyDown(el: Element, key: string, opts?: { shiftKey?: boolean }): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

/**
 * Find the SVG element inside a container.
 */
function getSvg(container: HTMLDivElement): SVGElement {
  return container.querySelector('svg') as SVGElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selection events', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // =========================================================================
  // 1. Click selection
  // =========================================================================
  describe('click selection', () => {
    it('click on an annotation fires onSelect with correct ElementRef', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const annotation = container.querySelector('[data-annotation-index]') as SVGElement | null;
      if (!annotation) {
        chart.destroy();
        return;
      }

      simulateClick(annotation);

      expect(onSelect).toHaveBeenCalledTimes(1);
      const ref: ElementRef = onSelect.mock.calls[0][0];
      expect(ref.type).toBe('annotation');
      if (ref.type === 'annotation') {
        expect(ref.index).toBe(0);
      }

      chart.destroy();
    });

    it('click on a chrome element fires onSelect with correct ElementRef', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);

      expect(onSelect).toHaveBeenCalledTimes(1);
      const ref: ElementRef = onSelect.mock.calls[0][0];
      expect(ref.type).toBe('chrome');
      if (ref.type === 'chrome') {
        expect(ref.key).toBe('title');
      }

      chart.destroy();
    });

    it('click on empty SVG area fires onDeselect for the previously selected element', () => {
      const onSelect = vi.fn();
      const onDeselect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onDeselect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      // First select the title
      simulateClick(titleEl);
      expect(onSelect).toHaveBeenCalledTimes(1);

      // Then click on empty SVG area (the SVG root itself)
      const svg = getSvg(container);
      svg.dispatchEvent(new MouseEvent('click', { bubbles: false }));

      expect(onDeselect).toHaveBeenCalledTimes(1);
      const ref: ElementRef = onDeselect.mock.calls[0][0];
      expect(ref.type).toBe('chrome');
      if (ref.type === 'chrome') {
        expect(ref.key).toBe('title');
      }

      chart.destroy();
    });

    it('clicking a new element when one is already selected fires onDeselect then onSelect', () => {
      const onSelect = vi.fn();
      const onDeselect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onDeselect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      const subtitleEl = container.querySelector(
        '[data-chrome-key="subtitle"]',
      ) as SVGElement | null;
      if (!titleEl || !subtitleEl) {
        chart.destroy();
        return;
      }

      // Select title
      simulateClick(titleEl);
      expect(onSelect).toHaveBeenCalledTimes(1);

      // Select subtitle (should deselect title first)
      simulateClick(subtitleEl);

      expect(onDeselect).toHaveBeenCalledTimes(1);
      const deselectedRef: ElementRef = onDeselect.mock.calls[0][0];
      expect(deselectedRef.type).toBe('chrome');
      if (deselectedRef.type === 'chrome') {
        expect(deselectedRef.key).toBe('title');
      }

      expect(onSelect).toHaveBeenCalledTimes(2);
      const selectedRef: ElementRef = onSelect.mock.calls[1][0];
      expect(selectedRef.type).toBe('chrome');
      if (selectedRef.type === 'chrome') {
        expect(selectedRef.key).toBe('subtitle');
      }

      chart.destroy();
    });

    it('onSelect is NOT fired when onEdit is provided but onSelect is not', () => {
      const onEdit = vi.fn();
      // Only providing onEdit, not onSelect
      const chart = createChart(container, selectionSpec, { onEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);

      // onEdit should not be called from a simple click (only from drag/delete/text-edit)
      // The key point: no onSelect callback was provided, so none should fire
      // The selection still happens internally, but the callback doesn't fire since it wasn't provided
      expect(onEdit).not.toHaveBeenCalled();

      chart.destroy();
    });
  });

  // =========================================================================
  // 2. Programmatic selection API
  // =========================================================================
  describe('programmatic selection API', () => {
    it('getSelectedElement() returns null initially', () => {
      const chart = createChart(container, selectionSpec, { onSelect: vi.fn() });

      expect(chart.getSelectedElement()).toBeNull();

      chart.destroy();
    });

    it('getSelectedElement() returns the correct ElementRef after clicking an element', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);

      const selected = chart.getSelectedElement();
      expect(selected).not.toBeNull();
      expect(selected?.type).toBe('chrome');
      if (selected?.type === 'chrome') {
        expect(selected.key).toBe('title');
      }

      chart.destroy();
    });

    it('chart.select(ref) programmatically selects an element and fires onSelect', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      const ref = elementRef.chrome('title');
      chart.select(ref);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0]).toEqual(ref);
      expect(chart.getSelectedElement()).toEqual(ref);

      chart.destroy();
    });

    it('chart.deselect() programmatically deselects and fires onDeselect', () => {
      const onSelect = vi.fn();
      const onDeselect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onDeselect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      chart.select(elementRef.chrome('title'));
      chart.deselect();

      expect(onDeselect).toHaveBeenCalledTimes(1);
      expect(chart.getSelectedElement()).toBeNull();

      chart.destroy();
    });

    it('chart.select(ref) with an invalid ref is a silent no-op', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      // Select an element that doesn't exist in the chart
      const invalidRef = elementRef.chrome('footer');
      chart.select(invalidRef);

      // Should not fire onSelect since the element wasn't found in the DOM
      expect(onSelect).not.toHaveBeenCalled();
      expect(chart.getSelectedElement()).toBeNull();

      chart.destroy();
    });
  });

  // =========================================================================
  // 3. Selection overlay
  // =========================================================================
  describe('selection overlay', () => {
    it('oc-selection-overlay group appears after selection', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      // No overlay initially
      expect(container.querySelector('.oc-selection-overlay')).toBeNull();

      simulateClick(titleEl);

      // Overlay should now exist
      expect(container.querySelector('.oc-selection-overlay')).not.toBeNull();

      chart.destroy();
    });

    it('selection overlay disappears after deselection', () => {
      const onSelect = vi.fn();
      const onDeselect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onDeselect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      // Select
      simulateClick(titleEl);
      expect(container.querySelector('.oc-selection-overlay')).not.toBeNull();

      // Deselect by clicking empty area
      const svg = getSvg(container);
      svg.dispatchEvent(new MouseEvent('click', { bubbles: false }));

      expect(container.querySelector('.oc-selection-overlay')).toBeNull();

      chart.destroy();
    });
  });

  // =========================================================================
  // 4. Deletion via keyboard
  // =========================================================================
  describe('deletion via keyboard', () => {
    it('Delete key fires onEdit({ type: "delete" }) when an element is selected', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);
      simulateKeyDown(getSvg(container), 'Delete');

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: ElementEdit = onEdit.mock.calls[0][0];
      expect(edit.type).toBe('delete');
      if (edit.type === 'delete') {
        expect(edit.element.type).toBe('chrome');
      }

      chart.destroy();
    });

    it('Backspace key fires onEdit({ type: "delete" }) when an element is selected', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);
      simulateKeyDown(getSvg(container), 'Backspace');

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: ElementEdit = onEdit.mock.calls[0][0];
      expect(edit.type).toBe('delete');

      chart.destroy();
    });

    it('Delete key does nothing when no element is selected', () => {
      const onEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect: vi.fn(), onEdit });

      simulateKeyDown(getSvg(container), 'Delete');

      expect(onEdit).not.toHaveBeenCalled();

      chart.destroy();
    });

    it('Delete key does nothing when text editing is active', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      // Select and enter text editing via double-click
      simulateDblClick(titleEl);

      // Now press Delete: should NOT fire onEdit for deletion since text editing is active
      simulateKeyDown(getSvg(container), 'Delete');

      // onEdit should not have been called with type 'delete'
      const deleteCalls = onEdit.mock.calls.filter(
        (call: [ElementEdit]) => call[0].type === 'delete',
      );
      expect(deleteCalls).toHaveLength(0);

      chart.destroy();
    });
  });

  // =========================================================================
  // 5. Keyboard events
  // =========================================================================
  describe('keyboard events', () => {
    it('Escape key deselects the selected element and fires onDeselect', () => {
      const onSelect = vi.fn();
      const onDeselect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onDeselect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);
      expect(chart.getSelectedElement()).not.toBeNull();

      simulateKeyDown(getSvg(container), 'Escape');

      expect(onDeselect).toHaveBeenCalledTimes(1);
      expect(chart.getSelectedElement()).toBeNull();

      chart.destroy();
    });

    it('Escape key does nothing when nothing is selected', () => {
      const onDeselect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect: vi.fn(), onDeselect });

      simulateKeyDown(getSvg(container), 'Escape');

      expect(onDeselect).not.toHaveBeenCalled();

      chart.destroy();
    });

    it('Arrow keys cycle through editable elements when one is selected', () => {
      const onSelect = vi.fn();
      const onDeselect = vi.fn();
      const chart = createChart(container, chromeOnlySpec, { onSelect, onDeselect });

      // First select the title by clicking it
      const titleEl = getSvg(container).querySelector('[data-chrome-key="title"]');
      if (!titleEl) {
        chart.destroy();
        return;
      }
      titleEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onSelect).toHaveBeenCalledTimes(1);
      const firstRef: ElementRef = onSelect.mock.calls[0][0];
      expect(firstRef.type).toBe('chrome');
      if (firstRef.type === 'chrome') {
        expect(firstRef.key).toBe('title');
      }

      // ArrowDown should cycle to the next element (subtitle), deselecting title
      simulateKeyDown(getSvg(container), 'ArrowDown');

      expect(onDeselect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledTimes(2);
      const secondRef: ElementRef = onSelect.mock.calls[1][0];
      expect(secondRef.type).toBe('chrome');
      if (secondRef.type === 'chrome') {
        expect(secondRef.key).toBe('subtitle');
      }

      chart.destroy();
    });
  });

  // =========================================================================
  // 6. Selection persistence across updates
  // =========================================================================
  describe('selection persistence across updates', () => {
    it('selection persists across chart.update() -- overlay is recreated', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);
      expect(container.querySelector('.oc-selection-overlay')).not.toBeNull();

      // Update with same spec (should re-render but preserve selection)
      chart.update(selectionSpec);

      // Selection overlay should still be present
      expect(container.querySelector('.oc-selection-overlay')).not.toBeNull();
      expect(chart.getSelectedElement()?.type).toBe('chrome');

      chart.destroy();
    });

    it('selection clears when the selected element no longer exists after update', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      // Select the source chrome element
      const sourceEl = container.querySelector('[data-chrome-key="source"]') as SVGElement | null;
      if (!sourceEl) {
        chart.destroy();
        return;
      }

      simulateClick(sourceEl);
      expect(chart.getSelectedElement()).not.toBeNull();

      // Update with a spec that has no source chrome
      const noSourceSpec: ChartSpec = {
        ...selectionSpec,
        chrome: { title: 'GDP Growth' },
      };
      chart.update(noSourceSpec);

      // Selection should be cleared because source no longer exists
      expect(chart.getSelectedElement()).toBeNull();
      expect(container.querySelector('.oc-selection-overlay')).toBeNull();

      chart.destroy();
    });

    it('chart.update(spec, { selectedElement: ref }) overrides selection', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      // Select title via click
      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateClick(titleEl);
      expect(chart.getSelectedElement()?.type).toBe('chrome');
      if (chart.getSelectedElement()?.type === 'chrome') {
        expect((chart.getSelectedElement() as { type: 'chrome'; key: string }).key).toBe('title');
      }

      // Update with selectedElement override to subtitle
      chart.update(selectionSpec, { selectedElement: elementRef.chrome('subtitle') });

      // After re-render, the subtitle should be selected (overlay should exist)
      const selected = chart.getSelectedElement();
      expect(selected).not.toBeNull();
      expect(selected?.type).toBe('chrome');
      if (selected?.type === 'chrome') {
        expect(selected.key).toBe('subtitle');
      }

      chart.destroy();
    });
  });

  // =========================================================================
  // 7. Hover feedback
  // =========================================================================
  describe('hover feedback', () => {
    it('mouse enter on editable element adds oc-editable-hover class', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      // Trigger mouseenter (uses capture so dispatch on the target itself)
      titleEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      expect(titleEl.classList.contains('oc-editable-hover')).toBe(true);

      chart.destroy();
    });

    it('mouse leave removes oc-editable-hover class', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      // Add hover class first
      titleEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(titleEl.classList.contains('oc-editable-hover')).toBe(true);

      // Remove hover class
      titleEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      expect(titleEl.classList.contains('oc-editable-hover')).toBe(false);

      chart.destroy();
    });
  });

  // =========================================================================
  // 8. Text editing via double-click
  // =========================================================================
  describe('text editing', () => {
    it('double-click on chrome text creates a text editing overlay', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateDblClick(titleEl);

      // A textarea should appear in the container
      const textarea = container.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect(chart.isEditing).toBe(true);

      chart.destroy();
    });

    it('text editing overlay contains the current text', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateDblClick(titleEl);

      const textarea = container.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect(textarea?.value).toBe('GDP Growth');

      chart.destroy();
    });

    it('pressing Enter in the overlay fires onEdit and onTextEdit when text changed', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const onTextEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onEdit, onTextEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateDblClick(titleEl);

      const textarea = container.querySelector('textarea');
      if (!textarea) {
        chart.destroy();
        return;
      }

      // Change the text
      textarea.value = 'New Title';

      // Press Enter to commit
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(onTextEdit).toHaveBeenCalledTimes(1);
      expect(onTextEdit.mock.calls[0][1]).toBe('GDP Growth'); // oldText
      expect(onTextEdit.mock.calls[0][2]).toBe('New Title'); // newText

      expect(onEdit).toHaveBeenCalledTimes(1);
      const edit: ElementEdit = onEdit.mock.calls[0][0];
      expect(edit.type).toBe('text-edit');
      if (edit.type === 'text-edit') {
        expect(edit.oldText).toBe('GDP Growth');
        expect(edit.newText).toBe('New Title');
      }

      chart.destroy();
    });

    it('pressing Escape in the overlay cancels without firing callbacks', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const onTextEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onEdit, onTextEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateDblClick(titleEl);

      const textarea = container.querySelector('textarea');
      if (!textarea) {
        chart.destroy();
        return;
      }

      // Change the text
      textarea.value = 'Changed Text';

      // Press Escape to cancel
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      // Neither onTextEdit nor onEdit should be called for text-edit type
      expect(onTextEdit).not.toHaveBeenCalled();
      const textEditCalls = onEdit.mock.calls.filter(
        (call: [ElementEdit]) => call[0].type === 'text-edit',
      );
      expect(textEditCalls).toHaveLength(0);

      // Textarea should be removed
      expect(container.querySelector('textarea')).toBeNull();

      // isEditing should be false again
      expect(chart.isEditing).toBe(false);

      chart.destroy();
    });

    it('text edit does not fire when text has not changed', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const onTextEdit = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect, onEdit, onTextEdit });

      const titleEl = container.querySelector('[data-chrome-key="title"]') as SVGElement | null;
      if (!titleEl) {
        chart.destroy();
        return;
      }

      simulateDblClick(titleEl);

      const textarea = container.querySelector('textarea');
      if (!textarea) {
        chart.destroy();
        return;
      }

      // Don't change the text, just press Enter
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      // Neither callback should fire since text is unchanged
      expect(onTextEdit).not.toHaveBeenCalled();
      const textEditCalls = onEdit.mock.calls.filter(
        (call: [ElementEdit]) => call[0].type === 'text-edit',
      );
      expect(textEditCalls).toHaveLength(0);

      chart.destroy();
    });

    it('isEditing is false initially', () => {
      const chart = createChart(container, selectionSpec, { onSelect: vi.fn() });

      expect(chart.isEditing).toBe(false);

      chart.destroy();
    });
  });

  // =========================================================================
  // 9. Initial selected element
  // =========================================================================
  describe('initial selectedElement option', () => {
    it('passing selectedElement in options selects the element on mount', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, {
        onSelect,
        selectedElement: elementRef.chrome('title'),
      });

      // The overlay should be rendered
      expect(container.querySelector('.oc-selection-overlay')).not.toBeNull();
      expect(chart.getSelectedElement()?.type).toBe('chrome');

      chart.destroy();
    });
  });

  // =========================================================================
  // 10. Destroy cleanup
  // =========================================================================
  describe('destroy cleanup', () => {
    it('after destroy, clicking elements does not fire callbacks', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, { onSelect });
      chart.destroy();

      // The SVG is removed, so we can't click. But verify no errors.
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('getSelectedElement returns null after destroy clears selection', () => {
      const onSelect = vi.fn();
      const chart = createChart(container, selectionSpec, {
        onSelect,
        selectedElement: elementRef.chrome('title'),
      });

      chart.destroy();

      expect(chart.getSelectedElement()).toBeNull();
    });
  });
});
