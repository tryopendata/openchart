import type { ResolvedLabel } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { automaticControlPoint, refreshConnector } from '../geometry';
import { isAutoPlacement } from '../placement';

const connector: NonNullable<ResolvedLabel['connector']> = {
  from: { x: 10, y: 20 },
  to: { x: 200, y: 160 },
  endpoint: { x: 205, y: 165 },
  stroke: 'black',
  style: 'curve',
  arrow: true,
};
const bounds = { x: 10, y: 10, width: 70, height: 20 };

describe('engine connector control', () => {
  it('preserves the automatic formula, including missing-exit fallback', () => {
    expect(automaticControlPoint({ x: 10, y: 20 }, { x: 110, y: 120 })).toEqual({ x: 30, y: 80 });
    expect(automaticControlPoint({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual({ x: 70, y: 30 });
    expect(automaticControlPoint({ x: 10, y: 20 }, { x: 110, y: 70 }, 'vertical')).toEqual({
      x: 30,
      y: 50,
    });
  });
  it('omitted and zero bend produce exactly the same control point', () => {
    const plain = refreshConnector(connector, bounds, 0)!;
    const zero = refreshConnector({ ...connector, bend: 0 }, bounds, 0)!;
    // The curve is shaped to the data point, not the pulled-back tip.
    expect(plain.control).toEqual(automaticControlPoint(plain.from, plain.endpoint!, plain.exit));
    expect(zero.control).toEqual(plain.control);
  });
  it.each([-1, -0.5, 0.5, 1])('displaces by the directed chord normal for bend %s', (bend) => {
    const base = refreshConnector(connector, bounds, 0)!;
    const bent = refreshConnector({ ...connector, bend }, bounds, 0)!;
    const end = connector.endpoint!;
    expect(bent.control!.x).toBeCloseTo(base.control!.x - bend * (base.from.y - end.y));
    expect(bent.control!.y).toBeCloseTo(base.control!.y + bend * (base.from.x - end.x));
    expect(bent.from).toEqual(base.from);
  });
  it.each([-1, -0.5, 0, 0.5, 1])('ends aimed at the marker for bend %s', (bend) => {
    const c = refreshConnector({ ...connector, bend }, bounds, 4)!;
    const end = connector.endpoint!;
    // The tail tangent (control -> to) runs through the data point.
    const cross =
      (c.to.x - c.control!.x) * (end.y - c.control!.y) -
      (c.to.y - c.control!.y) * (end.x - c.control!.x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
    expect(Math.hypot(end.x - c.to.x, end.y - c.to.y)).toBeCloseTo(6);
  });
  it('recomputes control after a block move and preserves authored attachment offset', () => {
    const original = refreshConnector(
      { ...connector, fromOffset: { dx: 5, dy: -8 }, bend: 0.4 },
      bounds,
      4,
    )!;
    const next = refreshConnector(original, { ...bounds, x: 90 }, 4)!;
    expect(next.control).not.toEqual(original.control);
    expect(next.endpoint).toEqual(connector.endpoint);
    expect(next.fromOffset).toEqual({ dx: 5, dy: -8 });
  });
});

describe('manual placement predicate', () => {
  it.each([undefined])('treats %j as automatic', (offset) => {
    expect(isAutoPlacement({ offset })).toBe(true);
  });
  it.each([
    {},
    { dx: 0 },
    { dx: 0, dy: 0 },
    { dx: 1 },
    { dy: -1 },
  ])('treats %j as manual', (offset) => {
    expect(isAutoPlacement({ offset })).toBe(false);
  });
  it('keeps explicit anchors and drop-lines manual even with zero offset', () => {
    expect(isAutoPlacement({ anchor: 'left', offset: { dx: 0, dy: 0 } })).toBe(false);
    expect(isAutoPlacement({ connector: 'drop-line' })).toBe(false);
  });
});
