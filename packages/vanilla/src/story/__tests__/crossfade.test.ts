/**
 * Whole-chart crossfade fallback tests.
 *
 * crossfadeUpdate ghosts the current SVG over the container, applies the
 * update underneath, then fades the ghost out. These tests pin the ghost
 * lifecycle (attributes, cleanup, position restore) and the skip paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crossfadeUpdate } from '../crossfade';

function containerWithSVG(): HTMLElement {
  const container = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  container.appendChild(svg);
  document.body.appendChild(container);
  return container;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('crossfadeUpdate', () => {
  it('ghosts the current SVG, applies the update, and cleans up on the safety timer', () => {
    const container = containerWithSVG();
    let applied = false;

    crossfadeUpdate(container, () => {
      applied = true;
      // Mid-update the ghost is already overlaid: applyUpdate runs with two
      // SVGs in the container (the live one plus the aria-hidden clone).
      const ghosts = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(ghosts.length).toBe(1);
      expect((ghosts[0] as SVGElement).style.pointerEvents).toBe('none');
    });

    expect(applied).toBe(true);
    // Ghost fading: opacity driven to 0, container pinned for positioning.
    const ghost = container.querySelector('svg[aria-hidden="true"]') as SVGElement;
    expect(ghost.style.opacity).toBe('0');
    expect(container.style.position).toBe('relative');

    // transitionend never fires under happy-dom; the safety timeout cleans up.
    vi.advanceTimersByTime(1000);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeNull();
    expect(container.style.position).toBe('');
  });

  it('preserves an existing container position instead of clobbering it', () => {
    const container = containerWithSVG();
    container.style.position = 'absolute';

    crossfadeUpdate(container, () => {});
    expect(container.style.position).toBe('absolute');

    vi.advanceTimersByTime(1000);
    // A caller-set position must survive cleanup.
    expect(container.style.position).toBe('absolute');
  });

  it('swaps instantly under reduced motion', () => {
    const container = containerWithSVG();
    let applied = false;

    crossfadeUpdate(
      container,
      () => {
        applied = true;
      },
      { reducedMotion: true },
    );

    expect(applied).toBe(true);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  it('swaps instantly when the container has no SVG yet', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let applied = false;

    crossfadeUpdate(container, () => {
      applied = true;
    });

    expect(applied).toBe(true);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('swaps instantly for a non-positive duration', () => {
    const container = containerWithSVG();
    crossfadeUpdate(container, () => {}, { duration: 0 });
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  it('cleans up via transitionend when it does fire', () => {
    const container = containerWithSVG();
    crossfadeUpdate(container, () => {});

    const ghost = container.querySelector('svg[aria-hidden="true"]') as SVGElement;
    ghost.dispatchEvent(new Event('transitionend'));

    expect(container.querySelector('svg[aria-hidden="true"]')).toBeNull();
    expect(container.style.position).toBe('');
  });
});
