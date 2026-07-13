/**
 * Scroll-driver tests, focused on the host that broke it: a page that scrolls
 * an INNER CONTAINER rather than the document.
 *
 * That is not an edge case. Ladle sets `body { overflow: hidden }` and scrolls a
 * nested div; so do modals, dashboard panes, and most app shells. In all of them
 * `window.scrollY` stays pinned at 0 and scroll events never reach a `window`
 * listener (scroll does not bubble), so the driver saw nothing and the story sat
 * frozen on step 0.
 *
 * Both tests below fail against a driver that listens on `window` and reads
 * `window.scrollY`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScrollDriver } from '../scroll-driver';

const VIEWPORT_H = 800;

/** Drive rects from a virtual scroll offset instead of a real layout engine. */
function makeStep(offsetTop: number, height: number, scrollRef: { y: number }): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      top: offsetTop - scrollRef.y,
      bottom: offsetTop + height - scrollRef.y,
      height,
    }) as DOMRect;
  return el;
}

describe('createScrollDriver in an inner-container scroller', () => {
  let scroller: HTMLElement;
  let container: HTMLElement;
  let steps: HTMLElement[];
  /** The inner container's scroll offset. `window.scrollY` stays 0 throughout. */
  const scrollRef = { y: 0 };

  beforeEach(() => {
    scrollRef.y = 0;
    vi.stubGlobal('innerHeight', VIEWPORT_H);
    // The page itself never scrolls. This is the whole point.
    vi.stubGlobal('scrollY', 0);
    // The driver rAF-throttles its scroll handler; run the callback inline so a
    // dispatched scroll event is fully processed by the time the test asserts.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    scroller = document.createElement('div');
    container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ top: 0 - scrollRef.y, bottom: 3000 - scrollRef.y, height: 3000 }) as DOMRect;

    steps = [0, 1000, 2000].map((top) => makeStep(top, 1000, scrollRef));
    for (const s of steps) container.appendChild(s);
    scroller.appendChild(container);
    document.body.appendChild(scroller);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  /** Scroll the inner container and dispatch the event it would really emit. */
  function scrollInnerTo(y: number) {
    scrollRef.y = y;
    scroller.dispatchEvent(new Event('scroll', { bubbles: false }));
  }

  it('advances the step when an inner container scrolls, not the window', () => {
    const driver = createScrollDriver({ triggerPosition: 0.4 });
    const frames: number[] = [];
    driver.progress.subscribe((f) => frames.push(f.step));

    driver.setContainer(container);
    steps.forEach((el, i) => {
      driver.registerStep(i, el);
    });

    // Trigger line sits at 0.4 * 800 = 320px. Scrolling the inner container by
    // 1200px puts step 1 (top 1000) at -200 and step 2 (top 2000) at 800, so the
    // last step whose top has crossed the trigger is step 1.
    scrollInnerTo(1200);

    expect(driver.progress.get().step).toBe(1);
    expect(frames.at(-1)).toBe(1);

    driver.destroy();
  });

  it('reads direction from the container rect, not window.scrollY', () => {
    const driver = createScrollDriver({ triggerPosition: 0.4 });
    driver.progress.subscribe(() => {});
    driver.setContainer(container);
    steps.forEach((el, i) => {
      driver.registerStep(i, el);
    });

    scrollInnerTo(1200);
    expect(driver.progress.get().direction).toBe('down');

    // Scroll back up. window.scrollY never moved, so a scrollY-based driver
    // would still report 'down' here.
    scrollInnerTo(400);
    expect(driver.progress.get().direction).toBe('up');

    driver.destroy();
  });

  it('stops emitting after destroy', () => {
    const driver = createScrollDriver();
    const seen: number[] = [];
    driver.progress.subscribe((f) => seen.push(f.step));
    driver.setContainer(container);
    steps.forEach((el, i) => {
      driver.registerStep(i, el);
    });

    driver.destroy();
    const countAtDestroy = seen.length;

    scrollInnerTo(1200);

    expect(seen.length).toBe(countAtDestroy);
  });
});
