/**
 * Line simplification for map outlines. Coordinates are longitude and latitude
 * treated as flat x and y, which is close enough to decide which points along
 * a short border a 720px map cannot show. Areas and centers are measured on the
 * sphere instead (d3-geo), where flat math breaks across the 180th meridian.
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
