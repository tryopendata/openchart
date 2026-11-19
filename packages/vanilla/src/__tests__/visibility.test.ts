import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createFakeObserver, stubPageLayout } from '../__test-fixtures__/visibility';
import { isSeen, observedCount, playWhenSeen, setObserverFactory, whenSeen } from '../visibility';

describe('isSeen', () => {
  const entry = (ratio: number, visibleHeight: number, rootHeight: number | null) => ({
    isIntersecting: ratio > 0,
    intersectionRatio: ratio,
    intersectionRect: { height: visibleHeight },
    rootBounds: rootHeight === null ? null : { height: rootHeight },
  });

  it('counts a quarter of the element as seen', () => {
    expect(isSeen(entry(0.25, 50, 800))).toBe(true);
  });

  it('does not count a tenth of a short element', () => {
    expect(isSeen(entry(0.1, 20, 800))).toBe(false);
  });

  it('counts a tall element filling a quarter of the viewport', () => {
    // A 5000px element: 200px visible is 4% of it but 25% of the viewport.
    expect(isSeen(entry(0.04, 200, 800))).toBe(true);
  });

  it('ignores the visible-height rule without root bounds', () => {
    expect(isSeen(entry(0.04, 200, null))).toBe(false);
  });

  it('never counts a non-intersecting entry', () => {
    expect(isSeen(entry(0, 0, 800))).toBe(false);
  });
});

describe('whenSeen', () => {
  let fake: ReturnType<typeof createFakeObserver>;
  let layout: ReturnType<typeof stubPageLayout>;

  beforeEach(() => {
    fake = createFakeObserver();
    setObserverFactory(fake.factory);
    layout = stubPageLayout();
  });

  afterEach(() => {
    setObserverFactory(null);
    layout.mockRestore();
    document.body.innerHTML = '';
  });

  it('fires at a ratio of 0.25 and unobserves', () => {
    const el = createContainer();
    const cb = vi.fn();
    whenSeen(el, cb);
    expect(fake.observed.has(el)).toBe(true);
    fake.fire(el, 0.25, 100);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(fake.unobserved).toContain(el);
    expect(observedCount()).toBe(0);
    // A later intersection no longer reaches the callback.
    fake.fire(el, 1, 400);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires for a tall element through the visible-height rule', () => {
    const el = createContainer(600, 5000);
    const cb = vi.fn();
    whenSeen(el, cb);
    fake.fire(el, 0.04, 200, 800);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire at a ratio of 0.1', () => {
    const el = createContainer();
    const cb = vi.fn();
    whenSeen(el, cb);
    fake.fire(el, 0.1, 40, 800);
    expect(cb).not.toHaveBeenCalled();
    expect(fake.observed.has(el)).toBe(true);
  });

  it('shares one observer and disconnects it once no targets remain', () => {
    const a = createContainer();
    const b = createContainer();
    const cancelA = whenSeen(a, () => {});
    whenSeen(b, () => {});
    expect(fake.created).toBe(1);
    cancelA();
    expect(fake.unobserved).toContain(a);
    expect(fake.disconnected).toBe(0);
    fake.fire(b, 1, 400);
    expect(fake.disconnected).toBe(1);
    expect(observedCount()).toBe(0);
  });

  it('cancel unobserves without firing', () => {
    const el = createContainer();
    const cb = vi.fn();
    const cancel = whenSeen(el, cb);
    cancel();
    expect(observedCount()).toBe(0);
    fake.fire(el, 1, 400);
    expect(cb).not.toHaveBeenCalled();
  });

  it('observes a zero-size element and fires once it is seen', () => {
    // A chart in a closed tab or accordion: the page lays out, the element has
    // no size yet. It plays when it opens and scrolls into view, not at mount.
    const el = document.createElement('div');
    document.body.appendChild(el);
    const cb = vi.fn();
    whenSeen(el, cb);
    expect(cb).not.toHaveBeenCalled();
    expect(fake.observed.has(el)).toBe(true);
    fake.fire(el, 1, 300);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires at once when the page has no layout engine', () => {
    layout.mockRestore();
    const cb = vi.fn();
    whenSeen(createContainer(), cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(fake.created).toBe(0);
  });

  it('fires at once without IntersectionObserver', () => {
    setObserverFactory(null);
    vi.stubGlobal('IntersectionObserver', undefined);
    try {
      const cb = vi.fn();
      whenSeen(createContainer(), cb);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('playWhenSeen', () => {
  let fake: ReturnType<typeof createFakeObserver>;
  let layout: ReturnType<typeof stubPageLayout>;

  beforeEach(() => {
    fake = createFakeObserver();
    setObserverFactory(fake.factory);
    layout = stubPageLayout();
  });

  afterEach(() => {
    setObserverFactory(null);
    layout.mockRestore();
    document.body.innerHTML = '';
  });

  it('pauses the root until seen, then resumes and plays', () => {
    const container = createContainer();
    const root = document.createElement('div');
    container.appendChild(root);
    const play = vi.fn();
    const cancel = playWhenSeen(container, root, 'visible', play);
    expect(cancel).toBeTypeOf('function');
    expect(root.style.getPropertyValue('--oc-play-state')).toBe('paused');
    expect(play).not.toHaveBeenCalled();
    fake.fire(container, 0.5, 200);
    expect(play).toHaveBeenCalledTimes(1);
    expect(root.style.getPropertyValue('--oc-play-state')).toBe('');
  });

  it("plays at once for trigger 'mount'", () => {
    const container = createContainer();
    const play = vi.fn();
    expect(playWhenSeen(container, container, 'mount', play)).toBeNull();
    expect(play).toHaveBeenCalledTimes(1);
    expect(fake.created).toBe(0);
  });
});
