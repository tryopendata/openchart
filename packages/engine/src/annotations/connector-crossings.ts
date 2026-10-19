import type { Point, Rect, ResolvedLabel } from '@opendata-ai/openchart-core';
import type { PlacementObstacle } from './placement';

type Segment = { a: Point; b: Point };
type Obstacle = {
  bounds: Rect;
  segment?: Segment;
  kind: PlacementObstacle['kind'];
  /** Stamps for the last segment that tested this obstacle and the last score it counted toward. */
  tested: number;
  counted: number;
};
const CELL = 64;
const contains = (r: Rect, p: Point) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const overlaps = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
const bounds = ({ a, b }: Segment): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

function intersects(a: Segment, b: Segment): boolean {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const c1 = cross(a.a, a.b, b.a),
    c2 = cross(a.a, a.b, b.b);
  const c3 = cross(b.a, b.b, a.a),
    c4 = cross(b.a, b.b, a.b);
  if (c1 * c2 > 0 || c3 * c4 > 0) return false;
  const ra = bounds(a),
    rb = bounds(b);
  return (
    ra.x <= rb.x + rb.width &&
    rb.x <= ra.x + ra.width &&
    ra.y <= rb.y + rb.height &&
    rb.y <= ra.y + ra.height
  );
}
function crossesRect(s: Segment, r: Rect): boolean {
  if (contains(r, s.a) || contains(r, s.b)) return true;
  const points = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
  return points.some((a, i) => intersects(s, { a, b: points[(i + 1) % 4] }));
}
/** Bounded curve sampling uses the same resolved control point as rendering. */
function segments(connector: NonNullable<ResolvedLabel['connector']>): Segment[] {
  if (connector.style !== 'curve' || !connector.control)
    return [{ a: connector.from, b: connector.to }];
  const result: Segment[] = [];
  let previous = connector.from;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16,
      u = 1 - t;
    const next = {
      x: u * u * connector.from.x + 2 * u * t * connector.control.x + t * t * connector.to.x,
      y: u * u * connector.from.y + 2 * u * t * connector.control.y + t * t * connector.to.y,
    };
    result.push({ a: previous, b: next });
    previous = next;
  }
  return result;
}

/** Spatially indexed leader/label/mark crossings for bounded placement search. */
export class ConnectorCrossings {
  private cells = new Map<string, Set<Obstacle>>();
  private all = new Set<Obstacle>();
  private oversized = new Set<Obstacle>();
  private stamp = 0;
  private keys(r: Rect): string[] | undefined {
    const count =
      (Math.floor((r.x + r.width) / CELL) - Math.floor(r.x / CELL) + 1) *
      (Math.floor((r.y + r.height) / CELL) - Math.floor(r.y / CELL) + 1);
    if (!Number.isFinite(count) || count > 1024) return undefined;
    const keys: string[] = [];
    for (let x = Math.floor(r.x / CELL); x <= Math.floor((r.x + r.width) / CELL); x++)
      for (let y = Math.floor(r.y / CELL); y <= Math.floor((r.y + r.height) / CELL); y++)
        keys.push(`${x},${y}`);
    return keys;
  }
  private insert(obstacle: Obstacle): void {
    this.all.add(obstacle);
    const keys = this.keys(obstacle.bounds);
    if (!keys) {
      this.oversized.add(obstacle);
      return;
    }
    for (const key of keys) {
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(obstacle);
    }
  }
  addBox(box: PlacementObstacle): void {
    this.insert({ bounds: box, kind: box.kind, tested: 0, counted: 0 });
  }
  addConnector(connector: ResolvedLabel['connector']): void {
    if (connector)
      for (const segment of segments(connector))
        this.insert({
          bounds: bounds(segment),
          segment,
          kind: 'annotation',
          tested: 0,
          counted: 0,
        });
  }
  score(connector: ResolvedLabel['connector']): number {
    if (!connector) return 0;
    // Stamps instead of per-segment Sets: this runs once per placement candidate.
    const scoreStamp = ++this.stamp;
    let hits = 0;
    for (const segment of segments(connector)) {
      const segmentStamp = ++this.stamp;
      const test = (obstacle: Obstacle) => {
        if (obstacle.tested === segmentStamp || obstacle.counted === scoreStamp) return;
        obstacle.tested = segmentStamp;
        // The observation being explained is not an unrelated obstacle.
        if (
          (obstacle.kind === 'mark' || obstacle.kind === 'line' || obstacle.kind === 'area-fill') &&
          connector.endpoint &&
          contains(obstacle.bounds, connector.endpoint)
        )
          return;
        // Disjoint boxes can neither cross nor contain: skip the exact tests.
        if (!overlaps(box, obstacle.bounds)) return;
        if (
          obstacle.segment
            ? intersects(segment, obstacle.segment)
            : crossesRect(segment, obstacle.bounds)
        ) {
          obstacle.counted = scoreStamp;
          hits++;
        }
      };
      const box = bounds(segment);
      const keys = this.keys(box);
      if (!keys) {
        for (const obstacle of this.all) test(obstacle);
        continue;
      }
      for (const obstacle of this.oversized) test(obstacle);
      for (const key of keys) {
        const cell = this.cells.get(key);
        if (cell) for (const obstacle of cell) test(obstacle);
      }
    }
    return hits * 2;
  }
}
