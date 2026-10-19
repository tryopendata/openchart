import type { GeoLabelComponent, GeoLabelGeometry, Point, Rect } from '@opendata-ai/openchart-core';
import type { GeoIdentityTransform, GeoPermissibleObjects, GeoProjection, GeoStream } from 'd3-geo';
import { geoClipRectangle, geoPath, geoStream } from 'd3-geo';

const EPS = 1e-7;
export const GEO_LABEL_VERTEX_LIMIT = 50_000;
export const GEO_LABEL_SEARCH_LIMIT = 2048;
export type LabelProjection = GeoProjection | GeoIdentityTransform;
export interface GeoGeometryLimits {
  maxVertices?: number;
  /** Bound transient collector storage; overflowing features are omitted atomically. */
  maxCaptureVertices?: number;
  maxSearchCells?: number;
  tolerance?: number;
  /** Full feature fill for proving cross-polygon nonzero cancellation. */
  fillComponents?: GeoLabelComponent[];
  /** Shared across one feature, including all candidate components. */
  workBudget?: { remaining: number };
  onDiagnostic?: (message: string) => void;
}
export function ringArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}
export function ringBounds(ring: Point[]): Rect {
  let x = Infinity;
  let y = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const p of ring) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  }
  return { x, y, width: right - x, height: bottom - y };
}
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t =
    dx || dy
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
      : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Boundary is not a proven interior. */
export function ringContains(ring: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (segmentDistance(p, a, b) <= EPS) return false;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function componentContains(component: GeoLabelComponent, p: Point): boolean {
  return (
    ringContains(component.exterior, p) &&
    !component.holes.some(
      (h) =>
        ringContains(h, p) || h.some((a, i) => segmentDistance(p, a, h[(i + 1) % h.length]) <= EPS),
    )
  );
}
function ringsAreSimple(
  rings: Point[][],
  onDiagnostic?: (message: string) => void,
  clipBoundary?: Rect,
): boolean {
  const edges = rings.flatMap((ring, r) =>
    ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return {
        a,
        b,
        r,
        i,
        n: ring.length,
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
      };
    }),
  );
  const bounds = ringBounds(rings.flat());
  const side = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(edges.length))));
  const cellX = (x: number) =>
    Math.max(
      0,
      Math.min(side - 1, Math.floor(((x - bounds.x) / Math.max(bounds.width, EPS)) * side)),
    );
  const cellY = (y: number) =>
    Math.max(
      0,
      Math.min(side - 1, Math.floor(((y - bounds.y) / Math.max(bounds.height, EPS)) * side)),
    );
  const buckets = new Map<number, number[]>();
  let checked = 0,
    entries = 0;
  const cross = (a: Point, b: Point, p: Point) =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  for (const [index, edge] of edges.entries()) {
    const keys: number[] = [],
      neighbors = new Set<number>();
    for (let x = cellX(edge.minX); x <= cellX(edge.maxX); x++)
      for (let y = cellY(edge.minY); y <= cellY(edge.maxY); y++) {
        if (++entries > 1_000_000) {
          onDiagnostic?.('Polygon topology proof exceeded its bounded spatial-index budget.');
          return false;
        }
        const key = x + y * side;
        keys.push(key);
        for (const prior of buckets.get(key) ?? []) neighbors.add(prior);
      }
    for (const prior of neighbors) {
      if (++checked > 500_000) {
        onDiagnostic?.('Polygon topology proof exceeded its bounded edge-comparison budget.');
        return false;
      }
      const other = edges[prior];
      if (
        edge.r === other.r &&
        (Math.abs(edge.i - other.i) === 1 || Math.abs(edge.i - other.i) === edge.n - 1)
      )
        continue;
      if (
        edge.minY > other.maxY + EPS ||
        other.minY > edge.maxY + EPS ||
        edge.minX > other.maxX + EPS ||
        other.minX > edge.maxX + EPS
      )
        continue;
      const c1 = cross(edge.a, edge.b, other.a),
        c2 = cross(edge.a, edge.b, other.b),
        c3 = cross(other.a, other.b, edge.a),
        c4 = cross(other.a, other.b, edge.b);
      if (c1 * c2 <= EPS && c3 * c4 <= EPS) {
        const onBoundary = (p: Point) =>
          clipBoundary &&
          (Math.abs(p.x - clipBoundary.x) <= EPS ||
            Math.abs(p.x - clipBoundary.x - clipBoundary.width) <= EPS ||
            Math.abs(p.y - clipBoundary.y) <= EPS ||
            Math.abs(p.y - clipBoundary.y - clipBoundary.height) <= EPS);
        const contacts = [edge.a, edge.b, other.a, other.b].filter(
          (p) =>
            segmentDistance(p, edge.a, edge.b) <= EPS &&
            segmentDistance(p, other.a, other.b) <= EPS,
        );
        if (contacts.length && contacts.every(onBoundary) && !(c1 * c2 < -EPS && c3 * c4 < -EPS))
          continue;
        onDiagnostic?.(
          'Projected polygon rings cross or touch ambiguously; no interior anchor is inferred.',
        );
        return false;
      }
    }
    for (const key of keys) {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }
  }
  return true;
}
interface RingTree {
  bounds: Rect;
  items: number[];
  children?: RingTree[];
}
function ringParentIndex(bounds: Rect[]): (point: Point) => number[] | undefined {
  const full = ringBounds(
    bounds.flatMap((b) => [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
    ]),
  );
  const root: RingTree = { bounds: full, items: [] };
  const insert = (tree: RingTree, index: number, depth: number) => {
    const b = bounds[index],
      cx = tree.bounds.x + tree.bounds.width / 2,
      cy = tree.bounds.y + tree.bounds.height / 2;
    const x = b.x + b.width <= cx ? 0 : b.x >= cx ? 1 : -1,
      y = b.y + b.height <= cy ? 0 : b.y >= cy ? 1 : -1;
    if (depth >= 16 || x < 0 || y < 0) {
      tree.items.push(index);
      return;
    }
    tree.children ??= Array.from({ length: 4 }, (_, i) => ({
      bounds: {
        x: tree.bounds.x + ((i % 2) * tree.bounds.width) / 2,
        y: tree.bounds.y + (Math.floor(i / 2) * tree.bounds.height) / 2,
        width: tree.bounds.width / 2,
        height: tree.bounds.height / 2,
      },
      items: [],
    }));
    insert(tree.children[x + y * 2], index, depth + 1);
  };
  bounds.forEach((_b, i) => {
    insert(root, i, 0);
  });
  let visited = 0;
  return (point) => {
    const result: number[] = [];
    let exhausted = false;
    const visit = (tree: RingTree) => {
      const b = tree.bounds;
      if (
        point.x < b.x - EPS ||
        point.x > b.x + b.width + EPS ||
        point.y < b.y - EPS ||
        point.y > b.y + b.height + EPS
      )
        return;
      for (const item of tree.items) {
        if (++visited > 250_000) {
          exhausted = true;
          return;
        }
        result.push(item);
      }
      if (!exhausted)
        tree.children?.forEach((child) => {
          if (!exhausted) visit(child);
        });
    };
    visit(root);
    return exhausted ? undefined : result;
  };
}
/** Rebuild cut polygons by nesting; emitted ring order supplies stable ties. */
export function reconstructProjectedComponents(
  input: Point[][],
  onDiagnostic?: (message: string) => void,
  clipBoundary?: Rect,
): GeoLabelComponent[] {
  if (input.some((ring) => ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) {
    onDiagnostic?.('Nonfinite projected polygon ring cannot prove an interior.');
    return [];
  }
  for (const ring of input) {
    if (ring.length < 3 || Math.abs(ringArea(ring)) > EPS) continue;
    const a = ring[0];
    const b = ring.reduce(
      (best, p) =>
        Math.hypot(p.x - a.x, p.y - a.y) > Math.hypot(best.x - a.x, best.y - a.y) ? p : best,
      a,
    );
    const baseline = Math.hypot(b.x - a.x, b.y - a.y);
    if (
      baseline > 0 &&
      ring.some(
        (p) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / baseline > 0,
      )
    ) {
      onDiagnostic?.('Nontrivial zero-area projected ring cannot prove full-feature nonzero fill.');
      return [];
    }
  }
  const rings = input
    .map((r) => r.filter((p, i) => i === 0 || p.x !== r[i - 1].x || p.y !== r[i - 1].y))
    .map((r) =>
      r.length > 1 && r[0].x === r.at(-1)!.x && r[0].y === r.at(-1)!.y ? r.slice(0, -1) : r,
    )
    .filter(
      (r) =>
        r.length >= 3 &&
        r.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
        Math.abs(ringArea(r)) > EPS,
    );
  if (!ringsAreSimple(rings, onDiagnostic, clipBoundary)) return [];
  const areas = rings.map((r) => Math.abs(ringArea(r)));
  const boxes = rings.map(ringBounds),
    query = ringParentIndex(boxes);
  let work = 0,
    exhausted = false;
  const parents = rings.map((ring, i) => {
    if (exhausted) return -1;
    const b = boxes[i];
    const nearby = query(ring[0]);
    if (!nearby) {
      exhausted = true;
      return -1;
    }
    const candidates = nearby
      .filter(
        (j) =>
          areas[j] > areas[i] + EPS &&
          boxes[j].x <= b.x + EPS &&
          boxes[j].y <= b.y + EPS &&
          boxes[j].x + boxes[j].width + EPS >= b.x + b.width &&
          boxes[j].y + boxes[j].height + EPS >= b.y + b.height,
      )
      .sort((a, b) => areas[a] - areas[b] || a - b);
    for (const j of candidates) {
      const probes = clipBoundary ? ring : [ring[0]];
      for (const point of probes) {
        if ((work += rings[j].length) > 250_000) {
          exhausted = true;
          return -1;
        }
        if (ringContains(rings[j], point)) return j;
      }
    }
    return -1;
  });
  if (exhausted) {
    onDiagnostic?.('Polygon ring nesting proof exceeded its bounded containment budget.');
    return [];
  }
  const depth = (i: number): number => (parents[i] < 0 ? 0 : 1 + depth(parents[i]));
  const normalize = (r: Point[], exterior: boolean) =>
    ringArea(r) > 0 === exterior ? r : [...r].reverse();
  const children = new Map<number, number[]>();
  parents.forEach((parent, i) => {
    if (parent >= 0) {
      const mine = children.get(parent);
      if (mine) mine.push(i);
      else children.set(parent, [i]);
    }
  });
  return rings.flatMap((ring, i) =>
    depth(i) % 2
      ? []
      : [
          {
            index: i,
            exterior: normalize(ring, true),
            winding: Math.sign(ringArea(ring)),
            holes: (children.get(i) ?? [])
              .filter((j) => depth(j) % 2 === 1)
              .map((j) => normalize(rings[j], false)),
            holeWindings: (children.get(i) ?? [])
              .filter((j) => depth(j) % 2 === 1)
              .map((j) => -Math.sign(ringArea(rings[j]))),
          },
        ],
  );
}
function nonzeroWinding(components: GeoLabelComponent[], p: Point): number {
  let winding = 0;
  for (const component of components)
    for (const [index, ring] of [component.exterior, ...component.holes].entries()) {
      const multiplier =
        index === 0
          ? (component.winding ?? 1)
          : (component.holeWindings?.[index - 1] ?? component.winding ?? 1);
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j],
          b = ring[i],
          cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
        if (a.y <= p.y) {
          if (b.y > p.y && cross > 0) winding += multiplier;
        } else if (b.y <= p.y && cross < 0) winding -= multiplier;
      }
    }
  return winding;
}
function signedDistance(
  component: GeoLabelComponent,
  p: Point,
  fillComponents?: GeoLabelComponent[],
): number {
  if (!fillComponents || fillComponents.length <= 1) {
    // A clipped exterior-minus-holes is a subset of the original single
    // polygon's nonzero fill, irrespective of its global orientation.
    let distance2 = Infinity,
      inside = false;
    for (const [index, ring] of [component.exterior, ...component.holes].entries()) {
      let within = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j],
          b = ring[i],
          dx = b.x - a.x,
          dy = b.y - a.y,
          t =
            dx || dy
              ? Math.max(
                  0,
                  Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
                )
              : 0;
        const x = p.x - a.x - t * dx,
          y = p.y - a.y - t * dy;
        distance2 = Math.min(distance2, x * x + y * y);
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
          within = !within;
      }
      if (index === 0) inside = within;
      else if (within) inside = false;
    }
    const distance = Math.sqrt(distance2);
    return inside ? distance : -distance;
  }
  let distance2 = Infinity;
  let inside = false;
  const boundaries = fillComponents ?? [component];
  for (const part of boundaries)
    for (const ring of [part.exterior, ...part.holes])
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j],
          b = ring[i],
          dx = b.x - a.x,
          dy = b.y - a.y;
        const t =
          dx || dy
            ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
            : 0;
        const x = p.x - a.x - t * dx,
          y = p.y - a.y - t * dy;
        distance2 = Math.min(distance2, x * x + y * y);
      }
  inside =
    componentContains(component, p) && (!fillComponents || nonzeroWinding(fillComponents, p) !== 0);
  const distance = Math.sqrt(distance2);
  return inside ? distance : -distance;
}
/** Deterministic bounded best-first interior search, measured in current screen pixels. */
export function findInteriorAnchor(
  component: GeoLabelComponent,
  limits: GeoGeometryLimits = {},
): Point | undefined {
  const b = ringBounds(component.exterior);
  if (!Number.isFinite(b.width) || b.width <= 0 || b.height <= 0) return undefined;
  if (limits.workBudget && limits.workBudget.remaining <= 0) {
    limits.onDiagnostic?.('Shared feature interior proof reached its work budget.');
    return undefined;
  }
  const scanVertices =
    limits.fillComponents?.reduce(
      (sum, part) => sum + part.exterior.length + part.holes.reduce((n, h) => n + h.length, 0),
      0,
    ) ?? 0;
  if (limits.workBudget) {
    if (limits.workBudget.remaining < scanVertices) {
      limits.workBudget.remaining = 0;
      limits.onDiagnostic?.('Shared feature fill-bound proof reached its work budget.');
      return undefined;
    }
    limits.workBudget.remaining -= scanVertices;
  }
  const fillComponents = limits.fillComponents?.filter((part) => {
    const box = ringBounds(part.exterior);
    return (
      box.x <= b.x + b.width &&
      box.x + box.width >= b.x &&
      box.y <= b.y + b.height &&
      box.y + box.height >= b.y
    );
  });
  const vertices = (fillComponents ?? [component]).reduce(
    (sum, c) => sum + c.exterior.length + c.holes.reduce((n, h) => n + h.length, 0),
    0,
  );
  const cost = Math.max(1, vertices * 3),
    budget = limits.workBudget ?? { remaining: 500_000 };
  if (budget.remaining < cost) {
    budget.remaining = 0;
    limits.onDiagnostic?.('Shared feature interior proof reached its work budget.');
    return undefined;
  }
  let workLimited = false;
  type Cell = { x: number; y: number; h: number; d: number; max: number; order: number };
  let order = 0;
  const make = (x: number, y: number, h: number): Cell => {
    budget.remaining -= cost;
    const d = signedDistance(component, { x, y }, fillComponents);
    return { x, y, h, d, max: d + h * Math.SQRT2, order: order++ };
  };
  const queue = [make(b.x + b.width / 2, b.y + b.height / 2, Math.max(b.width, b.height) / 2)];
  const higher = (a: Cell, b: Cell) => a.max > b.max || (a.max === b.max && a.order < b.order);
  const push = (cell: Cell) => {
    let i = queue.length;
    queue.push(cell);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!higher(cell, queue[parent])) break;
      queue[i] = queue[parent];
      i = parent;
    }
    queue[i] = cell;
  };
  const pop = () => {
    const top = queue[0],
      last = queue.pop()!;
    if (queue.length) {
      let i = 0;
      while (i * 2 + 1 < queue.length) {
        let next = i * 2 + 1;
        if (next + 1 < queue.length && higher(queue[next + 1], queue[next])) next++;
        if (!higher(queue[next], last)) break;
        queue[i] = queue[next];
        i = next;
      }
      queue[i] = last;
    }
    return top;
  };
  let best = queue[0];
  let searched = 0;
  const cells = Math.min(
    limits.maxSearchCells ?? GEO_LABEL_SEARCH_LIMIT,
    Math.max(1, Math.floor(250_000 / Math.max(1, vertices))),
  );
  while (queue.length && searched++ < cells) {
    const c = pop();
    if (c.d > best.d) best = c;
    if (c.max - best.d <= (limits.tolerance ?? 0.5) || c.h <= EPS) continue;
    const h = c.h / 2;
    for (const dx of [-h, h])
      for (const dy of [-h, h]) {
        if (budget.remaining >= cost) push(make(c.x + dx, c.y + dy, h));
        else workLimited = true;
      }
  }
  if (queue.length || workLimited)
    limits.onDiagnostic?.(
      'Map label interior search reached its cell limit before its tolerance target.',
    );
  if (
    best.d > EPS &&
    componentContains(component, best) &&
    (!fillComponents || fillComponents.length <= 1 || nonzeroWinding(fillComponents, best) !== 0)
  )
    return { x: best.x, y: best.y };
  limits.onDiagnostic?.('No proven polygon interior within the bounded label search.');
  return undefined;
}
function collector(maxVertices = Infinity): {
  stream: GeoStream;
  rings: Point[][];
  groups: Point[][][];
  overflow: () => boolean;
  bounds: () => Rect;
} {
  const rings: Point[][] = [];
  const groups: Point[][][] = [];
  let group: Point[][] | undefined;
  let ring: Point[] | undefined;
  let count = 0,
    overflow = false,
    minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  return {
    rings,
    groups,
    overflow: () => overflow,
    bounds: () =>
      Number.isFinite(minX)
        ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        : { x: 0, y: 0, width: 0, height: 0 },
    stream: {
      point(x, y) {
        if (Number.isFinite(x) && Number.isFinite(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        if (++count > maxVertices) {
          overflow = true;
          rings.length = 0;
          groups.length = 0;
          ring = undefined;
          group = undefined;
        }
        if (!overflow) ring?.push({ x, y });
      },
      lineStart() {
        if (!overflow) {
          rings.push((ring = []));
          group?.push(ring);
        }
      },
      lineEnd() {
        ring = undefined;
      },
      polygonStart() {
        if (!overflow) groups.push((group = []));
      },
      polygonEnd() {
        group = undefined;
      },
      sphere() {},
    },
  };
}
export function componentArea(component: GeoLabelComponent): number {
  return Math.max(
    0,
    Math.abs(ringArea(component.exterior)) -
      component.holes.reduce((sum, h) => sum + Math.abs(ringArea(h)), 0),
  );
}
/** Clip the entire polygon, including holes, through d3's polygon rejoining stream. */
export function clipGeoLabelComponent(
  component: GeoLabelComponent,
  viewport: Rect,
  onDiagnostic?: (message: string) => void,
): GeoLabelComponent[] {
  const sink = collector();
  const clip = geoClipRectangle(
    viewport.x,
    viewport.y,
    viewport.x + viewport.width,
    viewport.y + viewport.height,
  )(sink.stream);
  clip.polygonStart();
  for (const ring of [component.exterior, ...component.holes]) {
    clip.lineStart();
    for (const p of ring) clip.point(p.x, p.y);
    clip.lineEnd();
  }
  clip.polygonEnd();
  return reconstructProjectedComponents(sink.rings, onDiagnostic, viewport).map((clipped) => ({
    ...clipped,
    winding: component.winding ?? 1,
    holeWindings: clipped.holes.map(() => component.winding ?? 1),
  }));
}
/** Bounded second-pass point proof without retaining rings (at most 25 probes). */
function streamingCanonicalAnchor(
  feature: GeoPermissibleObjects,
  projection: LabelProjection,
  bounds: Rect,
): Point | undefined {
  const raw = geoPath(projection).centroid(feature);
  const points: Point[] = [];
  if (Number.isFinite(raw[0]) && Number.isFinite(raw[1])) points.push({ x: raw[0], y: raw[1] });
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++)
      points.push({
        x: bounds.x + (bounds.width * (col + 0.5)) / 6,
        y: bounds.y + (bounds.height * (row + 0.5)) / 4,
      });
  const probes = points.slice(0, 25).map((point) => ({
    point,
    inside: false,
    parity: false,
    distance2: Infinity,
    area: 0,
    winding: 0,
  }));
  let first: Point | undefined,
    last: Point | undefined,
    area = 0,
    invalid = false;
  const segment = (a: Point, b: Point) => {
    area += a.x * b.y - b.x * a.y;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    for (const probe of probes) {
      const p = probe.point,
        t =
          dx || dy
            ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
            : 0;
      const x = p.x - a.x - t * dx,
        y = p.y - a.y - t * dy;
      probe.distance2 = Math.min(probe.distance2, x * x + y * y);
      const cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
      if (a.y <= p.y) {
        if (b.y > p.y && cross > 0) probe.winding++;
      } else if (b.y <= p.y && cross < 0) probe.winding--;
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
        probe.parity = !probe.parity;
    }
  };
  geoStream(
    feature,
    projection.stream({
      polygonStart() {
        area = 0;
        for (const p of probes) p.parity = false;
      },
      polygonEnd() {
        for (const p of probes)
          if (p.parity) {
            p.inside = true;
            p.area = Math.max(p.area, Math.abs(area / 2));
          }
      },
      lineStart() {
        first = last = undefined;
      },
      lineEnd() {
        if (first && last) segment(last, first);
      },
      point(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          invalid = true;
          return;
        }
        const p = { x, y };
        if (last) segment(last, p);
        else first = p;
        last = p;
      },
      sphere() {},
    }),
  );
  if (invalid) return undefined;
  return probes
    .filter((p) => p.winding !== 0 && p.distance2 > EPS * EPS)
    .sort((a, b) => b.area - a.area || b.distance2 - a.distance2)[0]?.point;
}
export function captureGeoLabelGeometry(
  featureId: string,
  feature: GeoPermissibleObjects,
  projection: LabelProjection,
  limits: GeoGeometryLimits = {},
): GeoLabelGeometry {
  const sink = collector(limits.maxCaptureVertices ?? 100_000);
  geoStream(feature, projection.stream(sink.stream));
  if (sink.overflow()) {
    const bounds = sink.bounds();
    const canonicalAnchor = streamingCanonicalAnchor(feature, projection, bounds);
    limits.onDiagnostic?.(
      `Map label geometry for ${featureId} exceeds the transient capture budget; complete rings are omitted and only a streaming-validated canonical anchor can be used.`,
    );
    if (!canonicalAnchor)
      limits.onDiagnostic?.(
        `No bounded streaming probe proved an interior for ${featureId}; the label remains in the inventory without a glyph.`,
      );
    return {
      featureId,
      bounds,
      canonicalAnchor,
      vertexCount: 0,
      mode: canonicalAnchor ? 'fallback' : 'unresolved',
      captureLimited: true,
    };
  }
  let proofLimited = false,
    rejectedGroup = false;
  const components = sink.groups.flatMap((group) =>
    reconstructProjectedComponents(group, (message) => {
      if (message.includes('budget')) proofLimited = true;
      else rejectedGroup = true;
      limits.onDiagnostic?.(message);
    }),
  );
  if (rejectedGroup) {
    limits.onDiagnostic?.(
      `Map label geometry for ${featureId} contains an unproven polygon group; full-feature nonzero fill cannot be inferred from the remaining groups.`,
    );
    return { featureId, bounds: sink.bounds(), vertexCount: 0, mode: 'unresolved' };
  }
  if (proofLimited) {
    const bounds = sink.bounds(),
      canonicalAnchor = streamingCanonicalAnchor(feature, projection, bounds);
    return {
      featureId,
      bounds,
      canonicalAnchor,
      mode: canonicalAnchor ? 'fallback' : 'unresolved',
      vertexCount: 0,
      searchLimited: true,
    };
  }
  components.forEach((component, index) => {
    component.index = index;
  });
  const all = components.flatMap((c) => [...c.exterior, ...c.holes.flat()]);
  const bounds = all.length ? ringBounds(all) : { x: 0, y: 0, width: 0, height: 0 };
  const largest = [...components].sort(
    (a, b) => componentArea(b) - componentArea(a) || a.index - b.index,
  );
  let searchLimited = false;
  let canonicalAnchor: Point | undefined;
  const workBudget = { remaining: 500_000 };
  for (const component of largest) {
    canonicalAnchor = findInteriorAnchor(component, {
      ...limits,
      fillComponents: components,
      workBudget,
      onDiagnostic(message) {
        searchLimited = true;
        limits.onDiagnostic?.(message);
      },
    });
    if (canonicalAnchor || workBudget.remaining <= 0) break;
  }
  if (!canonicalAnchor && searchLimited)
    canonicalAnchor = streamingCanonicalAnchor(feature, projection, sink.bounds());
  if (!canonicalAnchor)
    limits.onDiagnostic?.(`Map label geometry for ${featureId} has no proven interior anchor.`);
  const vertexCount = all.length;
  const retained = vertexCount <= (limits.maxVertices ?? GEO_LABEL_VERTEX_LIMIT);
  if (!retained)
    limits.onDiagnostic?.(
      `Map label geometry for ${featureId} exceeds the retained vertex budget; only its validated canonical anchor is available.`,
    );
  return {
    featureId,
    bounds,
    canonicalAnchor,
    ...(searchLimited ? { searchLimited: true } : {}),
    vertexCount: retained && canonicalAnchor ? vertexCount : 0,
    mode: !canonicalAnchor ? 'unresolved' : retained ? 'retained' : 'fallback',
    ...(retained && canonicalAnchor ? { components } : {}),
  };
}
/** Requests must already be ordered by callout/text priority, then canonical identity. */
export function captureGeoLabelGeometries(
  requests: Array<{ featureId: string; feature: GeoPermissibleObjects }>,
  projection: LabelProjection,
  limits: GeoGeometryLimits = {},
): GeoLabelGeometry[] {
  let remaining = limits.maxVertices ?? GEO_LABEL_VERTEX_LIMIT;
  return requests.map(({ featureId, feature }) => {
    const geometry = captureGeoLabelGeometry(featureId, feature, projection, {
      ...limits,
      maxVertices: remaining,
    });
    remaining -= geometry.vertexCount;
    return geometry;
  });
}
