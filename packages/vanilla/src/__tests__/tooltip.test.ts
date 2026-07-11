/**
 * Tooltip manager tests.
 *
 * Tests the createTooltipManager() show/hide lifecycle, positioning logic,
 * and cleanup behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';

const mockComputePosition = vi.fn();

vi.mock('@floating-ui/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>();
  return {
    ...actual,
    computePosition: (...args: unknown[]) => mockComputePosition(...args),
  };
});

// Import after mock so the module picks up the mock
const { createTooltipManager } = await import('../tooltip');

/**
 * Flush the microtask queue so computePosition's .then() resolves.
 */
const flushPositioning = () => vi.waitFor(() => Promise.resolve());

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const defaultPositionResult = {
  x: 0,
  y: 0,
  placement: 'bottom-start' as const,
  strategy: 'absolute' as const,
  middlewareData: {},
};

beforeEach(() => {
  mockComputePosition.mockResolvedValue(defaultPositionResult);
});

afterEach(() => {
  document.body.innerHTML = '';
  mockComputePosition.mockReset();
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('createTooltipManager lifecycle', () => {
  it('appends a tooltip element to the container on creation', () => {
    const container = createContainer();
    createTooltipManager(container);

    const tooltip = container.querySelector('.oc-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.getAttribute('role')).toBe('tooltip');
  });

  it('show() makes the tooltip visible', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Point A', fields: [{ label: 'Value', value: '42' }] }, 100, 100);

    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('block');
  });

  it('show() renders title and field content', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show(
      {
        title: '2021-Q1',
        fields: [
          { label: 'Revenue', value: '$1.2M', color: '#3b82f6' },
          { label: 'Growth', value: '+15%' },
        ],
      },
      100,
      100,
    );

    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.innerHTML).toContain('2021-Q1');
    expect(tooltip.innerHTML).toContain('Revenue');
    expect(tooltip.innerHTML).toContain('$1.2M');
    expect(tooltip.innerHTML).toContain('Growth');
    expect(tooltip.innerHTML).toContain('+15%');
  });

  it('show() renders color dot when field has color', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show(
      {
        title: 'Test',
        fields: [{ label: 'Value', value: '42', color: '#ff0000' }],
      },
      50,
      50,
    );

    const dot = container.querySelector('.oc-tooltip-dot') as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.style.background).toBe('#ff0000');
  });

  it('hide() hides the tooltip', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Test', fields: [{ label: 'V', value: '1' }] }, 100, 100);
    manager.hide();

    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('none');
  });

  it('Escape dismisses a visible tooltip without pointer movement (WCAG 1.4.13)', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Test', fields: [{ label: 'V', value: '1' }] }, 100, 100);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('none');
    manager.destroy();
  });

  it('destroy() removes the Escape listener', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Test', fields: [{ label: 'V', value: '1' }] }, 100, 100);
    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    manager.destroy();

    // Dispatch after destroy: no listener should touch the detached element
    tooltip.style.display = 'block';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip.style.display).toBe('block');
  });

  it('destroy() removes the tooltip element from the DOM', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    // Verify it exists
    expect(container.querySelector('.oc-tooltip')).not.toBeNull();

    manager.destroy();

    expect(container.querySelector('.oc-tooltip')).toBeNull();
  });

  it('show() updates content when called again', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'First', fields: [{ label: 'A', value: '1' }] }, 50, 50);

    let tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.innerHTML).toContain('First');

    manager.show({ title: 'Second', fields: [{ label: 'B', value: '2' }] }, 100, 100);

    tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.innerHTML).toContain('Second');
    // First content should be replaced
    expect(tooltip.innerHTML).not.toContain('First');

    manager.destroy();
  });
});

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

describe('tooltip positioning', () => {
  it('positions tooltip via computePosition with flip and shift', async () => {
    mockComputePosition.mockResolvedValueOnce({
      x: 112,
      y: 212,
      placement: 'bottom-start',
      strategy: 'absolute',
      middlewareData: {},
    });

    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Test', fields: [{ label: 'V', value: '1' }] }, 100, 200);
    await flushPositioning();

    // computePosition should have been called with the tooltip element
    expect(mockComputePosition).toHaveBeenCalledOnce();
    const [ref, tooltipEl, options] = mockComputePosition.mock.calls[0];
    expect(tooltipEl).toBeInstanceOf(HTMLElement);
    expect(options?.placement).toBe('bottom-start');
    // Should include offset, flip, and shift middleware
    expect(options?.middleware).toHaveLength(3);

    // Virtual reference should return a rect at the mouse position
    const rect = (ref as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect();
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);

    // Position should be applied from computePosition result
    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.left).toContain('px');
    expect(tooltip.style.top).toContain('px');

    manager.destroy();
  });

  it('discards stale position callbacks on rapid show() calls', async () => {
    type PosResult = {
      x: number;
      y: number;
      placement: string;
      strategy: string;
      middlewareData: Record<string, never>;
    };
    let resolveFirst!: (val: PosResult) => void;
    let resolveSecond!: (val: PosResult) => void;

    mockComputePosition
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveFirst = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveSecond = r;
          }),
      );

    const container = createContainer();
    const manager = createTooltipManager(container);

    // Two rapid show() calls
    manager.show({ title: 'A', fields: [{ label: 'V', value: '1' }] }, 10, 10);
    manager.show({ title: 'B', fields: [{ label: 'V', value: '2' }] }, 200, 200);

    // Resolve the second (latest) first
    resolveSecond({
      x: 212,
      y: 212,
      placement: 'bottom-start',
      strategy: 'absolute',
      middlewareData: {},
    });
    await flushPositioning();

    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    const posAfterSecond = tooltip.style.left;

    // Now resolve the first (stale) - should be discarded
    resolveFirst({
      x: 22,
      y: 22,
      placement: 'bottom-start',
      strategy: 'absolute',
      middlewareData: {},
    });
    await flushPositioning();

    // Position should not have changed (stale callback was discarded)
    expect(tooltip.style.left).toBe(posAfterSecond);

    manager.destroy();
  });

  it('sets container position to relative if not already set', () => {
    const container = createContainer();
    container.style.position = '';

    createTooltipManager(container);

    // createTooltipManager sets container.style.position to 'relative'
    // if it was empty
    expect(container.style.position).toBe('relative');
  });

  it('preserves existing container position style', () => {
    const container = createContainer();
    container.style.position = 'absolute';

    createTooltipManager(container);

    expect(container.style.position).toBe('absolute');
  });
});

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

describe('tooltip content escaping', () => {
  it('escapes HTML special characters in title and fields', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show(
      {
        title: '<script>alert("xss")</script>',
        fields: [{ label: 'A&B', value: 'val<ue' }],
      },
      50,
      50,
    );

    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    // Should not contain raw HTML tags - the <script> should be escaped
    expect(tooltip.innerHTML).not.toContain('<script>');
    // Should contain escaped versions of angle brackets and ampersands
    expect(tooltip.innerHTML).toContain('&lt;script&gt;');
    expect(tooltip.innerHTML).toContain('A&amp;B');
    // The value with < should be escaped
    expect(tooltip.innerHTML).toContain('val&lt;ue');

    manager.destroy();
  });
});
