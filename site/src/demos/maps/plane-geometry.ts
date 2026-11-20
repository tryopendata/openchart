/**
 * Plane geometry for map demos: line simplification, ring area and ring
 * centroid. Coordinates are longitude and latitude treated as flat x and y,
 * which is close enough to decide which points and islands a 720px map cannot
 * show, and where inside a state or country to place its symbol.
 */

/** A point as [x, y]. */
export type Point = number[];

/** Distance from `point` to the segment from `start` to `end`. */
function distanceToSegment(point: Point, start: Point, end: Point): number {
  const [px = 0, py = 0] = point;
  const [ax = 0, ay = 0] = start;
  const [bx = 0, by = 0] = end;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The line with every point dropped that lies within `tolerance` of the
 * simplified shape (Douglas-Peucker). The first and last points always stay,
 * so lines that meet at their ends still meet after simplification.
 */
export function simplifyLine(line: Point[], tolerance: number): Point[] {
  if (line.length <= 2) return line;
  const keep = new Array<boolean>(line.length).fill(false);
  keep[0] = true;
  keep[line.length - 1] = true;
  const spans: Array<[number, number]> = [[0, line.length - 1]];
  for (let span = spans.pop(); span; span = spans.pop()) {
    const [first, last] = span;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let index = first + 1; index < last; index++) {
      const distance = distanceToSegment(line[index] ?? [], line[first] ?? [], line[last] ?? []);
      if (distance > farthestDistance) {
        farthest = index;
        farthestDistance = distance;
      }
    }
    if (farthest < 0) continue;
    keep[farthest] = true;
    spans.push([first, farthest], [farthest, last]);
  }
  return line.filter((_, index) => keep[index]);
}

/** Twice the signed area of a closed ring (shoelace formula); the sign gives its winding. */
function twiceSignedArea(ring: Point[]): number {
  let total = 0;
  for (let index = 0; index < ring.length; index++) {
    const [x1 = 0, y1 = 0] = ring[index] ?? [];
    const [x2 = 0, y2 = 0] = ring[(index + 1) % ring.length] ?? [];
    total += x1 * y2 - x2 * y1;
  }
  return total;
}

/** The area enclosed by a closed ring of points, always positive. */
export function ringArea(ring: Point[]): number {
  return Math.abs(twiceSignedArea(ring)) / 2;
}

/**
 * The centroid of the area a closed ring encloses, as [x, y]. For a convex or
 * gently concave outline, such as most states and countries, it lies inside.
 */
export function ringCentroid(ring: Point[]): Point {
  const twiceArea = twiceSignedArea(ring);
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index++) {
    const [x1 = 0, y1 = 0] = ring[index] ?? [];
    const [x2 = 0, y2 = 0] = ring[(index + 1) % ring.length] ?? [];
    const cross = x1 * y2 - x2 * y1;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}
