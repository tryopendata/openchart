import { describe, expect, it } from 'vitest';
import { type LabelCandidate, resolveVisibleLabels } from '../labels';

function node(id: string, priority: number, x: number, y = 0, z = 0): LabelCandidate {
  return { id, priority, x, y, z };
}

describe('resolveVisibleLabels', () => {
  it('always shows the forced set, even outside the budget', () => {
    const nodes = [node('a', 1, 0), node('b', 0.9, 0), node('c', 0.0, 1000)];
    const visible = resolveVisibleLabels(nodes, new Set(['c']), { x: 0, y: 0, z: 0 }, 1);
    // Forced ids lead, and do not consume budget: the top-priority node follows.
    expect(visible).toEqual(['c', 'a']);
  });

  it('ranks by priority before camera distance', () => {
    const nodes = [node('near-low', 0.1, 1), node('far-high', 0.9, 500)];
    const visible = resolveVisibleLabels(nodes, new Set(), { x: 0, y: 0, z: 0 }, 1);
    expect([...visible]).toEqual(['far-high']);
  });

  it('breaks priority ties by camera distance', () => {
    const nodes = [node('far', 0.5, 500), node('near', 0.5, 10)];
    const visible = resolveVisibleLabels(nodes, new Set(), { x: 0, y: 0, z: 0 }, 1);
    expect([...visible]).toEqual(['near']);
  });

  it('re-ranks as the camera moves', () => {
    const nodes = [node('left', 0.5, -300), node('right', 0.5, 300)];
    const fromLeft = resolveVisibleLabels(nodes, new Set(), { x: -400, y: 0, z: 0 }, 1);
    const fromRight = resolveVisibleLabels(nodes, new Set(), { x: 400, y: 0, z: 0 }, 1);
    expect([...fromLeft]).toEqual(['left']);
    expect([...fromRight]).toEqual(['right']);
  });

  it('returns only the forced set for a zero budget', () => {
    const nodes = [node('a', 1, 0), node('z', 0.2, 5)];
    expect(resolveVisibleLabels(nodes, new Set(['z']), { x: 0, y: 0, z: 0 }, 0)).toEqual(['z']);
  });

  it('is deterministic for equal priority at equal distance', () => {
    const nodes = [node('b', 0.5, 0), node('a', 0.5, 0)];
    const once = resolveVisibleLabels(nodes, new Set(), { x: 0, y: 0, z: 0 }, 1);
    const twice = resolveVisibleLabels([...nodes].reverse(), new Set(), { x: 0, y: 0, z: 0 }, 1);
    expect([...once]).toEqual([...twice]);
  });
});
