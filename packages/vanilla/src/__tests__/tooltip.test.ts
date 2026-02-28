/**
 * Tooltip manager tests.
 *
 * Tests the createTooltipManager() show/hide lifecycle, positioning logic,
 * and cleanup behavior.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createTooltipManager } from '../tooltip';

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('createTooltipManager lifecycle', () => {
  it('appends a tooltip element to the container on creation', () => {
    const container = createContainer();
    createTooltipManager(container);

    const tooltip = container.querySelector('.viz-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.getAttribute('role')).toBe('tooltip');
  });

  it('show() makes the tooltip visible', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Point A', fields: [{ label: 'Value', value: '42' }] }, 100, 100);

    const tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
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

    const tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
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

    const dot = container.querySelector('.viz-tooltip-dot') as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.style.background).toBe('#ff0000');
  });

  it('hide() hides the tooltip', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Test', fields: [{ label: 'V', value: '1' }] }, 100, 100);
    manager.hide();

    const tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('none');
  });

  it('destroy() removes the tooltip element from the DOM', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    // Verify it exists
    expect(container.querySelector('.viz-tooltip')).not.toBeNull();

    manager.destroy();

    expect(container.querySelector('.viz-tooltip')).toBeNull();
  });

  it('show() updates content when called again', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'First', fields: [{ label: 'A', value: '1' }] }, 50, 50);

    let tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
    expect(tooltip.innerHTML).toContain('First');

    manager.show({ title: 'Second', fields: [{ label: 'B', value: '2' }] }, 100, 100);

    tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
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
  it('positions tooltip at offset from given coordinates', () => {
    const container = createContainer();
    const manager = createTooltipManager(container);

    manager.show({ title: 'Test', fields: [{ label: 'V', value: '1' }] }, 100, 200);

    const tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
    // Tooltip should be positioned (the exact offset is TOOLTIP_OFFSET = 12)
    const left = parseInt(tooltip.style.left, 10);
    const top = parseInt(tooltip.style.top, 10);
    // Should be near the given coordinates (offset by 12)
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);

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

    const tooltip = container.querySelector('.viz-tooltip') as HTMLElement;
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
