import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createFakeObserver, stubPageLayout } from '../__test-fixtures__/visibility';
import { createEntranceLifecycle, type EntranceArm } from '../entrance-lifecycle';
import { setObserverFactory } from '../visibility';

const PLAY_STATE = '--oc-play-state';

function makeRoot(container: Element): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('oc-animate');
  container.appendChild(svg);
  return svg;
}

function stubReducedMotion(matches: boolean) {
  return vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: matches && query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe('createEntranceLifecycle', () => {
  let fake: ReturnType<typeof createFakeObserver>;
  let layout: ReturnType<typeof stubPageLayout>;
  let container: HTMLDivElement;
  let root: SVGSVGElement;
  let onDeferredResize: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fake = createFakeObserver();
    setObserverFactory(fake.factory);
    layout = stubPageLayout();
    container = createContainer();
    root = makeRoot(container);
    onDeferredResize = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setObserverFactory(null);
    layout.mockRestore();
    document.body.innerHTML = '';
  });

  // happy-dom has no getAnimations, so cleanup takes the timer path; a short
  // totalMs pins that window.
  const armOpts = (overrides: Partial<EntranceArm> = {}): EntranceArm => ({
    container,
    root,
    trigger: 'visible',
    onPlay: () => ({ totalMs: 50 }),
    ...overrides,
  });

  it('holds until seen, plays, then settles and clears oc-animate', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onPlay = vi.fn(() => ({ totalMs: 50 }));
    const onSettled = vi.fn();
    entrance.arm(armOpts({ onPlay, onSettled }));

    expect(entrance.waiting).toBe(true);
    expect(entrance.playing).toBe(false);
    expect(root.style.getPropertyValue(PLAY_STATE)).toBe('paused');
    expect(onPlay).not.toHaveBeenCalled();

    fake.fire(container, 0.5, 200);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(entrance.waiting).toBe(false);
    expect(entrance.playing).toBe(true);
    expect(root.style.getPropertyValue(PLAY_STATE)).toBe('');

    vi.advanceTimersByTime(50);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(entrance.playing).toBe(false);
    expect(root.classList.contains('oc-animate')).toBe(false);
  });

  it("plays at once for trigger: 'mount'", () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onPlay = vi.fn(() => ({ totalMs: 50 }));
    entrance.arm(armOpts({ trigger: 'mount', onPlay }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(entrance.waiting).toBe(false);
    expect(entrance.playing).toBe(true);
    expect(fake.observed.size).toBe(0);
  });

  it('reset returns true while waiting and stops observing', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onPlay = vi.fn();
    entrance.arm(armOpts({ onPlay }));
    expect(entrance.reset()).toBe(true);
    expect(entrance.waiting).toBe(false);
    expect(fake.observed.has(container)).toBe(false);
    // The old root's hold is gone.
    expect(root.style.getPropertyValue(PLAY_STATE)).toBe('');
    fake.fire(container, 1, 400);
    expect(onPlay).not.toHaveBeenCalled();

    // Re-arming on a fresh root waits again.
    const next = makeRoot(container);
    entrance.arm(armOpts({ root: next, onPlay }));
    expect(entrance.waiting).toBe(true);
    fake.fire(container, 1, 400);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('reset returns false when playing or idle', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    expect(entrance.reset()).toBe(false);
    const onSettled = vi.fn();
    entrance.arm(armOpts({ trigger: 'mount', onSettled }));
    expect(entrance.reset()).toBe(false);
    expect(entrance.playing).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('drop cancels without playing and reports whether it was waiting', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onPlay = vi.fn();
    entrance.arm(armOpts({ onPlay }));
    expect(entrance.drop()).toBe(true);
    expect(entrance.waiting).toBe(false);
    fake.fire(container, 1, 400);
    expect(onPlay).not.toHaveBeenCalled();
    expect(entrance.drop()).toBe(false);
  });

  it('clears the paused hold on a persistent root when dropped', () => {
    // Graph hosts survive renders; a dropped hold must not leave them paused.
    const host = container;
    const entrance = createEntranceLifecycle({ onDeferredResize });
    entrance.arm(armOpts({ root: host, completion: 'js', onPlay: () => {} }));
    expect(host.style.getPropertyValue(PLAY_STATE)).toBe('paused');
    entrance.drop();
    expect(host.style.getPropertyValue(PLAY_STATE)).toBe('');

    entrance.arm(armOpts({ root: host, completion: 'js', onPlay: () => {} }));
    entrance.destroy();
    expect(host.style.getPropertyValue(PLAY_STATE)).toBe('');
  });

  it('admits resizes while waiting or idle, defers them while playing', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    expect(entrance.admitResize()).toBe(true);
    entrance.arm(armOpts());
    expect(entrance.admitResize()).toBe(true); // waiting: caller resets and re-arms
    fake.fire(container, 1, 400);
    expect(entrance.admitResize()).toBe(false);
    expect(entrance.admitResize()).toBe(false);
    expect(onDeferredResize).not.toHaveBeenCalled();
  });

  it('replays a deferred resize once, after onSettled, with the handle cleared', () => {
    const order: string[] = [];
    let admittedOnReplay: boolean | null = null;
    const entrance = createEntranceLifecycle({
      onDeferredResize: () => {
        order.push('resize');
        admittedOnReplay = entrance.admitResize();
      },
    });
    entrance.arm(
      armOpts({
        trigger: 'mount',
        onSettled: () => order.push(`settled:${entrance.playing}`),
      }),
    );
    expect(entrance.admitResize()).toBe(false);
    expect(entrance.admitResize()).toBe(false);
    vi.advanceTimersByTime(50);
    expect(order).toEqual(['settled:false', 'resize']);
    expect(admittedOnReplay).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(order).toEqual(['settled:false', 'resize']);
  });

  it('does not replay a deferred resize after a reset', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    entrance.arm(armOpts({ trigger: 'mount' }));
    expect(entrance.admitResize()).toBe(false);
    entrance.reset();
    // The next entrance settles without a stale resize replay.
    entrance.arm(armOpts({ root: makeRoot(container), trigger: 'mount' }));
    vi.advanceTimersByTime(50);
    expect(onDeferredResize).not.toHaveBeenCalled();
  });

  it('claim: owed until a render has content, and again after a waiting reset', () => {
    const entrance = createEntranceLifecycle();
    // Mounted empty: nothing to claim, still owed.
    expect(entrance.claim(false, true)).toBe(false);
    expect(entrance.claim(true, true)).toBe(true);
    entrance.arm(armOpts());
    // Waiting, then an update that empties the chart: still owed.
    entrance.reset();
    expect(entrance.claim(false, true)).toBe(false);
    expect(entrance.claim(true, true)).toBe(true);
    // A render with content settles the debt even when entrances are off.
    entrance.arm(armOpts({ root: makeRoot(container) }));
    entrance.reset();
    expect(entrance.claim(true, false)).toBe(false);
    expect(entrance.claim(true, true)).toBe(false);
  });

  it('claim: a reset after the entrance played owes nothing', () => {
    const entrance = createEntranceLifecycle();
    expect(entrance.claim(true, true)).toBe(true);
    entrance.arm(armOpts({ trigger: 'mount' }));
    entrance.reset();
    expect(entrance.claim(true, true)).toBe(false);
  });

  it('settles synchronously under reduced motion without opening a window', () => {
    stubReducedMotion(true);
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onPlay = vi.fn();
    const onSettled = vi.fn();
    entrance.arm(armOpts({ onPlay, onSettled }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(entrance.waiting).toBe(false);
    expect(entrance.playing).toBe(false);
    expect(entrance.admitResize()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    // CSS sets animation: none; the class stays (e2e/a11y/reduced-motion.spec.ts).
    expect(root.classList.contains('oc-animate')).toBe(true);
    // A later cancel leaves the settled root alone.
    entrance.reset();
    expect(root.classList.contains('oc-animate')).toBe(true);
  });

  it("completion: 'js' waits for canvasFinished only", async () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    let finish!: () => void;
    const canvasFinished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onSettled = vi.fn();
    entrance.arm(
      armOpts({
        trigger: 'mount',
        completion: 'js',
        onPlay: () => ({ canvasFinished }),
        onSettled,
      }),
    );
    expect(entrance.playing).toBe(true);
    vi.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(onSettled).not.toHaveBeenCalled();
    expect(entrance.admitResize()).toBe(false);

    finish();
    await canvasFinished;
    await Promise.resolve();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(entrance.playing).toBe(false);
    expect(onDeferredResize).toHaveBeenCalledTimes(1);
  });

  it("completion: 'js' settles when the canvas entrance is torn down (rejected)", async () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const canvasFinished = Promise.reject(new Error('torn down'));
    const onSettled = vi.fn();
    entrance.arm(
      armOpts({
        trigger: 'mount',
        completion: 'js',
        onPlay: () => ({ canvasFinished }),
        onSettled,
      }),
    );
    await canvasFinished.catch(() => {});
    await Promise.resolve();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("completion: 'js' with nothing to wait for settles at once", () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onSettled = vi.fn();
    entrance.arm(armOpts({ trigger: 'mount', completion: 'js', onPlay: () => {}, onSettled }));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(entrance.playing).toBe(false);
  });

  it('a cancelled js entrance never settles', async () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    let finish!: () => void;
    const canvasFinished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onSettled = vi.fn();
    entrance.arm(
      armOpts({
        trigger: 'mount',
        completion: 'js',
        onPlay: () => ({ canvasFinished }),
        onSettled,
      }),
    );
    entrance.drop();
    finish();
    await canvasFinished;
    await Promise.resolve();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('destroy cancels and refuses later resizes and arms', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onSettled = vi.fn();
    entrance.arm(armOpts({ trigger: 'mount', onSettled }));
    entrance.admitResize();
    entrance.destroy();
    vi.advanceTimersByTime(1000);
    expect(onSettled).not.toHaveBeenCalled();
    expect(onDeferredResize).not.toHaveBeenCalled();
    expect(entrance.playing).toBe(false);
    expect(entrance.admitResize()).toBe(false);
    const onPlay = vi.fn();
    entrance.arm(armOpts({ trigger: 'mount', onPlay }));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('passes the table fallback pad through to cleanup', () => {
    const entrance = createEntranceLifecycle({ onDeferredResize });
    const onSettled = vi.fn();
    entrance.arm(armOpts({ trigger: 'mount', onPlay: () => {}, onSettled, fallbackPadMs: 300 }));
    vi.advanceTimersByTime(299);
    expect(onSettled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
