/**
 * Focus model: standing composition (highlight ∩ search), hover layering, and
 * the FocusTransition retarget/progress rules (the p < 0.5 closest-endpoint
 * capture that halves worst-case hover-sweep jumps).
 */

import { describe, expect, it } from 'vitest';
import {
  composeStandingFocus,
  emptyFocusSnapshot,
  type FocusSnapshot,
  FocusTransition,
  focusSnapshotsEqual,
  layerHoverFocus,
} from '../focus-transition';

const linear = (t: number) => t;

const adjacency = new Map<string, Set<string>>([
  ['a', new Set(['b'])],
  ['b', new Set(['a', 'c'])],
  ['c', new Set(['b'])],
]);

describe('composeStandingFocus', () => {
  it('is empty when nothing is active', () => {
    const s = composeStandingFocus(null, null, new Set(), adjacency);
    expect(s.hasActive).toBe(false);
    expect(s.connected.size).toBe(0);
  });

  it('highlight alone drives the connected neighborhood', () => {
    const s = composeStandingFocus(new Set(['a']), null, new Set(), adjacency);
    expect(s.hasActive).toBe(true);
    // a + its neighbor b
    expect([...s.connected].sort()).toEqual(['a', 'b']);
  });

  it('intersects highlight and search when both active', () => {
    const s = composeStandingFocus(new Set(['a', 'b']), new Set(['b', 'c']), new Set(), adjacency);
    // intersection {b} → connected = b + neighbors a,c
    expect([...s.connected].sort()).toEqual(['a', 'b', 'c']);
    expect(s.searchMatches).toEqual(new Set(['b', 'c']));
  });

  it('falls back to search when the intersection is empty (fresher intent wins)', () => {
    const s = composeStandingFocus(new Set(['a']), new Set(['c']), new Set(), adjacency);
    // empty intersection → core = search matches {c}
    expect(s.hasActive).toBe(true);
    expect(s.searchMatches).toEqual(new Set(['c']));
    // connected derives from search core {c} → c + neighbor b
    expect([...s.connected].sort()).toEqual(['b', 'c']);
  });

  it('carries selection through as active', () => {
    const s = composeStandingFocus(null, null, new Set(['a']), adjacency);
    expect(s.hasActive).toBe(true);
    expect(s.selected).toEqual(new Set(['a']));
  });
});

describe('layerHoverFocus', () => {
  it('returns the standing snapshot when nothing is hovered', () => {
    const standing = composeStandingFocus(new Set(['a']), null, new Set(), adjacency);
    expect(layerHoverFocus(standing, null, null)).toBe(standing);
  });

  it('replaces the connected set with the hover neighborhood, keeping search/selection', () => {
    const standing = composeStandingFocus(null, new Set(['x']), new Set(['sel']), adjacency);
    const layered = layerHoverFocus(standing, 'b', new Set(['b', 'a', 'c']));
    expect(layered.hasActive).toBe(true);
    expect(layered.connected).toEqual(new Set(['b', 'a', 'c']));
    expect(layered.searchMatches).toEqual(new Set(['x']));
    expect(layered.selected).toEqual(new Set(['sel']));
  });
});

describe('FocusTransition', () => {
  const A: FocusSnapshot = {
    hasActive: true,
    connected: new Set(['a']),
    searchMatches: null,
    selected: new Set(),
  };
  const B: FocusSnapshot = {
    hasActive: true,
    connected: new Set(['b']),
    searchMatches: null,
    selected: new Set(),
  };
  const C: FocusSnapshot = {
    hasActive: true,
    connected: new Set(['c']),
    searchMatches: null,
    selected: new Set(),
  };

  it('progresses linearly from 0 to 1 over the duration', () => {
    const ft = new FocusTransition(A, 100, linear, 0);
    ft.retarget(B, 0);
    expect(ft.progress(0)).toBe(0);
    expect(ft.progress(50)).toBeCloseTo(0.5, 6);
    expect(ft.progress(100)).toBe(1);
    expect(ft.isSettled(100)).toBe(true);
  });

  it('retarget below the midpoint keeps the old prev (no forward snap)', () => {
    const ft = new FocusTransition(A, 100, linear, 0);
    ft.retarget(B, 0); // now A → B
    // At p=0.3 (< 0.5) the display is still nearer A; retargeting to C keeps A as prev.
    ft.retarget(C, 30);
    expect(ft.prev).toBe(A);
    expect(ft.next).toBe(C);
  });

  it('retarget at/after the midpoint captures the old next as prev', () => {
    const ft = new FocusTransition(A, 100, linear, 0);
    ft.retarget(B, 0);
    // At p=0.7 (>= 0.5) the display is nearer B; retargeting to C starts from B.
    ft.retarget(C, 70);
    expect(ft.prev).toBe(B);
    expect(ft.next).toBe(C);
  });

  it('retargeting to the current next is a no-op', () => {
    const ft = new FocusTransition(A, 100, linear, 0);
    ft.retarget(B, 0);
    ft.retarget(B, 40); // same target
    // startTime unchanged → progress continues from the original clock.
    expect(ft.progress(40)).toBeCloseTo(0.4, 6);
  });

  it('duration 0 settles immediately', () => {
    const ft = new FocusTransition(A, 0, linear, 0);
    ft.retarget(B, 0);
    expect(ft.progress(0)).toBe(1);
    expect(ft.isSettled(0)).toBe(true);
  });
});

describe('focusSnapshotsEqual', () => {
  it('treats identical snapshots as equal', () => {
    const s = composeStandingFocus(new Set(['a']), null, new Set(), adjacency);
    const t = composeStandingFocus(new Set(['a']), null, new Set(), adjacency);
    expect(focusSnapshotsEqual(s, t)).toBe(true);
  });

  it('distinguishes different connected sets', () => {
    expect(
      focusSnapshotsEqual(
        composeStandingFocus(new Set(['a']), null, new Set(), adjacency),
        composeStandingFocus(new Set(['c']), null, new Set(), adjacency),
      ),
    ).toBe(false);
  });

  it('empty snapshot equals empty snapshot', () => {
    expect(focusSnapshotsEqual(emptyFocusSnapshot(), emptyFocusSnapshot())).toBe(true);
  });
});
