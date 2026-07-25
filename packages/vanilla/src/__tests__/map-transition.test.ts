import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureFeatureFills, runMapFillTransition } from '../map-transition';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build a minimal map-shaped SVG: <path class="oc-map-feature"> per feature
 * and <circle class="oc-map-point"> per point. Mirrors the structure the
 * map renderer produces (data-key on features, data-point-key on points)
 * without needing the full mount/compile pipeline.
 */
function buildMapSvg(
  features: Array<{ key?: string; fill?: string }>,
  points: Array<{ key: string; fill?: string }> = [],
): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const f of features) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'oc-map-feature');
    if (f.key !== undefined) path.setAttribute('data-key', f.key);
    if (f.fill !== undefined) path.setAttribute('fill', f.fill);
    svg.appendChild(path);
  }
  for (const p of points) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'oc-map-point');
    circle.setAttribute('data-point-key', p.key);
    if (p.fill !== undefined) circle.setAttribute('fill', p.fill);
    svg.appendChild(circle);
  }
  document.body.appendChild(svg);
  return svg;
}

function featureAt(svg: SVGElement, index: number): Element {
  return svg.querySelectorAll('.oc-map-feature')[index];
}

// ---------------------------------------------------------------------------
// rAF mock (same manual-pump pattern as transition.test.ts so tweens are
// deterministic: no real timers, we control the frame clock)
// ---------------------------------------------------------------------------

let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

function setupRafMock() {
  rafCallbacks = new Map();
  nextRafId = 1;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    rafCallbacks.delete(id);
  });
}

/** Pump all pending rAF callbacks at the given timestamp. */
function pumpRaf(timestamp: number) {
  const cbs = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of cbs) {
    cb(timestamp);
  }
}

/** Run the rAF loop to completion by advancing past the tween duration. */
function runToCompletion(totalMs = 2000) {
  // First pump at t=0 sets startTime, then jump way past the end.
  pumpRaf(0);
  pumpRaf(totalMs);
}

beforeEach(() => {
  setupRafMock();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// captureFeatureFills
// ---------------------------------------------------------------------------

describe('captureFeatureFills', () => {
  it('returns an empty map for a null SVG', () => {
    // Mount code calls capture before the first render, when no SVG exists yet.
    const fills = captureFeatureFills(null);
    expect(fills.size).toBe(0);
  });

  it('captures feature fills keyed by data-key and point fills with a pt: prefix', () => {
    const svg = buildMapSvg(
      [
        { key: '06', fill: '#ff0000' },
        { key: '48', fill: '#00ff00' },
      ],
      [{ key: 'sf', fill: '#0000ff' }],
    );

    const fills = captureFeatureFills(svg);

    expect(fills.size).toBe(3);
    expect(fills.get('06')).toBe('#ff0000');
    expect(fills.get('48')).toBe('#00ff00');
    // Points share the map with features, namespaced so a feature id can
    // never collide with a point key.
    expect(fills.get('pt:sf')).toBe('#0000ff');
  });

  it('skips features without a data-key attribute', () => {
    // The selector is .oc-map-feature[data-key], so keyless features (e.g.
    // decorative geometry) are excluded rather than captured under a bogus key.
    const svg = buildMapSvg([{ fill: '#ff0000' }, { key: '48', fill: '#00ff00' }]);

    const fills = captureFeatureFills(svg);

    expect(fills.size).toBe(1);
    expect(fills.get('48')).toBe('#00ff00');
  });

  it('skips features that have a key but no fill attribute', () => {
    const svg = buildMapSvg([{ key: '06' }, { key: '48', fill: '#00ff00' }]);

    const fills = captureFeatureFills(svg);

    expect(fills.size).toBe(1);
    expect(fills.has('06')).toBe(false);
  });

  it('uses last-wins semantics for duplicate keys', () => {
    // The renderer stamps data-key with raw String(feature.id), so duplicate
    // feature ids in the source geometry produce duplicate keys. The capture
    // loop iterates document order and Map.set overwrites, so the LAST
    // element with a given key wins.
    const svg = buildMapSvg([
      { key: '06', fill: '#ff0000' },
      { key: '06', fill: '#0000ff' },
    ]);

    const fills = captureFeatureFills(svg);

    expect(fills.size).toBe(1);
    expect(fills.get('06')).toBe('#0000ff');
  });
});

// ---------------------------------------------------------------------------
// runMapFillTransition
// ---------------------------------------------------------------------------

describe('runMapFillTransition', () => {
  it('tweens a changed fill from the previous color to the new color', () => {
    const svg = buildMapSvg([{ key: '06', fill: '#0000ff' }], [{ key: 'sf', fill: '#00ff00' }]);
    const prevFills = new Map([
      ['06', '#ff0000'],
      ['pt:sf', '#ff0000'],
    ]);

    runMapFillTransition(svg, prevFills, { duration: 100 });

    // From-state is applied synchronously before the first frame, so there is
    // no flash of the final color while the first rAF is pending.
    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#ff0000');

    pumpRaf(0);
    pumpRaf(50);
    const mid = featureAt(svg, 0).getAttribute('fill');
    expect(mid).toMatch(/^rgb\(/);
    expect(mid).not.toBe('rgb(255, 0, 0)');
    expect(mid).not.toBe('rgb(0, 0, 255)');

    pumpRaf(100);
    // interpolateRgb serializes to rgb() form, so the final value is the
    // rgb equivalent of the target hex, not the raw '#0000ff' string.
    expect(featureAt(svg, 0).getAttribute('fill')).toBe('rgb(0, 0, 255)');
    const point = svg.querySelector('.oc-map-point');
    expect(point!.getAttribute('fill')).toBe('rgb(0, 255, 0)');
  });

  it('leaves a newly added fill untouched (no prev color to tween from)', () => {
    // A feature that gained data in the new render has no entry in prevFills,
    // so it should appear immediately at its final color rather than tweening
    // from nothing.
    const svg = buildMapSvg([{ key: '36', fill: '#0000ff' }]);

    runMapFillTransition(svg, new Map(), { duration: 100 });

    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');
    // No tweens means the early-return path: nothing scheduled on rAF.
    expect(rafCallbacks.size).toBe(0);
  });

  it('ignores removed fills (prev key with no matching element)', () => {
    // A feature that lost its data between renders exists in prevFills but
    // not in the new SVG. There is nothing to tween; must not crash.
    const svg = buildMapSvg([{ key: '06', fill: '#0000ff' }]);
    const prevFills = new Map([
      ['06', '#0000ff'],
      ['48', '#ff0000'], // gone from the new render
    ]);

    expect(() => {
      runMapFillTransition(svg, prevFills, { duration: 100 });
      runToCompletion();
    }).not.toThrow();

    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');
  });

  it('does not tween fills that are unchanged between snapshots', () => {
    const svg = buildMapSvg([
      { key: '06', fill: '#0000ff' },
      { key: '48', fill: '#00ff00' },
    ]);
    const prevFills = new Map([
      ['06', '#0000ff'], // unchanged: should be skipped entirely
      ['48', '#ff0000'], // changed: should tween
    ]);

    runMapFillTransition(svg, prevFills, { duration: 100 });
    runToCompletion();

    // The unchanged feature keeps its original attribute string; only the
    // changed one was rewritten by the interpolator.
    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');
    expect(featureAt(svg, 1).getAttribute('fill')).toBe('rgb(0, 255, 0)');
  });

  it('snaps changed fills to their final color when duration is zero', () => {
    // Zero duration takes the early-return path, which must undo the
    // synchronous from-snap or the map would be stuck at the old colors.
    const svg = buildMapSvg([{ key: '06', fill: '#0000ff' }]);
    const prevFills = new Map([['06', '#ff0000']]);

    runMapFillTransition(svg, prevFills, { duration: 0 });

    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');
    expect(rafCallbacks.size).toBe(0);
  });

  it('cancel() mid-tween snaps to the final color and stops the loop', () => {
    const svg = buildMapSvg([{ key: '06', fill: '#0000ff' }]);
    const prevFills = new Map([['06', '#ff0000']]);

    const handle = runMapFillTransition(svg, prevFills, { duration: 100 });
    pumpRaf(0);
    pumpRaf(50);

    handle.cancel();
    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');

    // Pumping after cancel must not resurrect the tween or throw: the rAF was
    // cancelled and the cancelled flag guards any stray callback.
    expect(() => pumpRaf(75)).not.toThrow();
    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');
  });

  it('supports interruption: cancel then start a second transition from the mid-tween color', () => {
    // Mirrors the mount flow when update() lands mid-transition: capture the
    // current (interpolated) fills, cancel the in-flight tween, re-render,
    // then start a new transition from the captured snapshot.
    const svg = buildMapSvg([{ key: '06', fill: '#0000ff' }]);
    const first = runMapFillTransition(svg, new Map([['06', '#ff0000']]), { duration: 100 });
    pumpRaf(0);
    pumpRaf(50);

    const midFills = captureFeatureFills(svg);
    first.cancel();

    // Simulate the re-render assigning a new target color.
    featureAt(svg, 0).setAttribute('fill', '#00ff00');

    expect(() => {
      runMapFillTransition(svg, midFills, { duration: 100 });
      runToCompletion();
    }).not.toThrow();

    expect(featureAt(svg, 0).getAttribute('fill')).toBe('rgb(0, 255, 0)');
  });

  it('cancel() after natural completion is a harmless no-op', () => {
    const svg = buildMapSvg([{ key: '06', fill: '#0000ff' }]);
    const handle = runMapFillTransition(svg, new Map([['06', '#ff0000']]), { duration: 100 });
    runToCompletion();

    expect(() => handle.cancel()).not.toThrow();
    // cancel() unconditionally snaps every tween to its raw `to` string, so a
    // post-completion cancel rewrites the interpolator's 'rgb(0, 0, 255)' back
    // to '#0000ff'. Visually identical, and confirms cancel is safe to call
    // late (e.g. from destroy()).
    expect(featureAt(svg, 0).getAttribute('fill')).toBe('#0000ff');
  });

  it('completes for feature ids containing quotes and backslashes', () => {
    // The renderer stamps data-key with raw String(feature.id). Keys with
    // quotes/backslashes are the same class of input that broke unescaped
    // querySelector lookups for mark keys. This implementation matches by
    // getAttribute + Map lookup (no selector interpolation), and this test
    // pins that: a future refactor to querySelector('[data-key="..."]')
    // without CSS.escape would throw or silently miss these features.
    const svg = buildMapSvg([
      { key: 'say "hi"', fill: '#0000ff' },
      { key: 'back\\slash', fill: '#00ff00' },
    ]);
    const prevFills = new Map([
      ['say "hi"', '#ff0000'],
      ['back\\slash', '#ff0000'],
    ]);

    expect(() => {
      runMapFillTransition(svg, prevFills, { duration: 100 });
      runToCompletion();
    }).not.toThrow();

    expect(featureAt(svg, 0).getAttribute('fill')).toBe('rgb(0, 0, 255)');
    expect(featureAt(svg, 1).getAttribute('fill')).toBe('rgb(0, 255, 0)');
  });
});
