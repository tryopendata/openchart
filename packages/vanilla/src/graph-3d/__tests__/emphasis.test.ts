import { describe, expect, it } from 'vitest';
import { composeStandingFocus, layerHoverFocus } from '../../graph/focus-transition';
import { EDGE_ALPHA_DEFAULT, resolveEmphasis, SEARCH_NON_MATCH_ALPHA } from '../emphasis';

const nodes = [
  { id: 'a', opacity: 1 },
  { id: 'b', opacity: 1 },
  { id: 'c', opacity: 1 },
  { id: 'seed', opacity: 1 },
];
const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'seed', target: 'c' },
];
const adjacency = new Map([
  ['a', new Set(['b'])],
  ['b', new Set(['a', 'c'])],
  ['c', new Set(['b', 'seed'])],
  ['seed', new Set(['c'])],
]);

function focus(opts: {
  highlight?: Set<string> | null;
  search?: Set<string> | null;
  selected?: Set<string>;
  hovered?: string | null;
  hoverSet?: Set<string> | null;
}) {
  const standing = composeStandingFocus(
    opts.highlight ?? null,
    opts.search ?? null,
    opts.selected ?? new Set(),
    adjacency,
  );
  return layerHoverFocus(standing, opts.hovered ?? null, opts.hoverSet ?? null);
}

describe('resolveEmphasis', () => {
  it('leaves everything at rest when nothing is emphasized', () => {
    const out = resolveEmphasis({
      nodes,
      edges,
      focus: focus({}),
      exemptIds: new Set(),
      dimOpacity: 0.3,
    });
    expect([...out.nodes.values()]).toEqual([1, 1, 1, 1]);
    expect([...out.edges.values()]).toEqual([
      EDGE_ALPHA_DEFAULT,
      EDGE_ALPHA_DEFAULT,
      EDGE_ALPHA_DEFAULT,
    ]);
  });

  it('dims outside the hover neighborhood and lights its edges', () => {
    const out = resolveEmphasis({
      nodes,
      edges,
      focus: focus({ hovered: 'a', hoverSet: new Set(['a', 'b']) }),
      exemptIds: new Set(),
      dimOpacity: 0.3,
    });
    expect(out.nodes.get('a')).toBe(1);
    expect(out.nodes.get('b')).toBe(1);
    expect(out.nodes.get('c')).toBe(0.3);
    // a->b has both endpoints connected; the others do not.
    expect(out.edges.get(0)).toBe(1);
    expect(out.edges.get(1)).toBeCloseTo(0.1);
    expect(out.edges.get(2)).toBeCloseTo(0.1);
  });

  it('exempts seed ids from dimming but not their edges', () => {
    const out = resolveEmphasis({
      nodes,
      edges,
      focus: focus({ hovered: 'a', hoverSet: new Set(['a', 'b']) }),
      exemptIds: new Set(['seed']),
      dimOpacity: 0.3,
    });
    expect(out.nodes.get('seed')).toBe(1);
    expect(out.edges.get(2)).toBeCloseTo(0.1);
  });

  it('intersects a highlight with the category filter through composeStandingFocus', () => {
    // highlight ∩ search: both active with a non-empty intersection.
    const out = resolveEmphasis({
      nodes,
      edges,
      focus: focus({ highlight: new Set(['a', 'b']), search: new Set(['b', 'c']) }),
      exemptIds: new Set(),
      dimOpacity: 0.2,
    });
    // The core is {b}; connected = {b} ∪ neighbors(b) = {a, b, c}.
    expect(out.nodes.get('a')).toBeCloseTo(1 * SEARCH_NON_MATCH_ALPHA);
    expect(out.nodes.get('b')).toBe(1);
    expect(out.nodes.get('seed')).toBeCloseTo(0.2 * SEARCH_NON_MATCH_ALPHA);
  });

  it('multiplies the compiled nodeOpacity into the result', () => {
    const out = resolveEmphasis({
      nodes: [{ id: 'a', opacity: 0.5 }],
      edges: [],
      focus: focus({}),
      exemptIds: new Set(),
      dimOpacity: 0.3,
    });
    expect(out.nodes.get('a')).toBe(0.5);
  });

  it('honours per-edge resting alpha from the width-as-opacity fallback', () => {
    const out = resolveEmphasis({
      nodes,
      edges,
      focus: focus({}),
      exemptIds: new Set(),
      dimOpacity: 0.3,
      edgeBaseAlpha: new Map([
        [0, 0.9],
        [1, 0.2],
      ]),
    });
    expect(out.edges.get(0)).toBe(0.9);
    expect(out.edges.get(1)).toBe(0.2);
    expect(out.edges.get(2)).toBe(EDGE_ALPHA_DEFAULT);
  });

  it('dims search non-matches and their edges', () => {
    const out = resolveEmphasis({
      nodes,
      edges,
      focus: focus({ search: new Set(['a']) }),
      exemptIds: new Set(['seed']),
      dimOpacity: 0.3,
    });
    // Mirrors 2D exactly: an active search makes every node "dimmed" (the
    // search core deliberately doesn't drive the connected-neighborhood path),
    // and non-matches take a second multiplier on top.
    expect(out.nodes.get('a')).toBe(0.3);
    // Exempt ids stay at the connected tier but are NOT exempt from search dimming.
    expect(out.nodes.get('seed')).toBeCloseTo(SEARCH_NON_MATCH_ALPHA);
    // seed->c touches no match, so it takes the search multiplier too.
    expect(out.edges.get(2)).toBeCloseTo(0.1 * SEARCH_NON_MATCH_ALPHA);
  });
});
