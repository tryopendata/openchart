import type {
  GeoLabelAffine,
  GeoLabelCandidate,
  GeoLabelGeometry,
  GeoLabelOverlay,
  GeoLabelsInput,
  Point,
  Rect,
} from '@opendata-ai/openchart-core';
import { clipGeoLabelComponent, componentArea, findInteriorAnchor } from './label-geometry';

export const GEO_TEXT_CANDIDATE_LIMIT = 200;
export const GEO_CALLOUT_CANDIDATE_LIMIT = 128;
const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
const within = (p: Point, r: Rect) =>
  p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height;
const boxWithin = (b: Rect, r: Rect) =>
  within(b, r) && within({ x: b.x + b.width, y: b.y + b.height }, r);
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + 2 &&
  a.x + a.width + 2 > b.x &&
  a.y < b.y + b.height + 2 &&
  a.y + a.height + 2 > b.y;
const transform = (p: Point, a: GeoLabelAffine): Point => ({
  x: p.x * a.k + a.tx,
  y: p.y * a.k + a.ty,
});
function visibleAnchor(
  geometry: GeoLabelGeometry,
  a: GeoLabelAffine,
  viewport: Rect,
  onIssue: (message: string, searchLimit: boolean) => void,
): Point | undefined {
  if (geometry.mode !== 'retained')
    return geometry.canonicalAnchor ? transform(geometry.canonicalAnchor, a) : undefined;
  const bounds = {
    x: geometry.bounds.x * a.k + a.tx,
    y: geometry.bounds.y * a.k + a.ty,
    width: geometry.bounds.width * a.k,
    height: geometry.bounds.height * a.k,
  };
  if (
    bounds.x + bounds.width < viewport.x ||
    bounds.y + bounds.height < viewport.y ||
    bounds.x > viewport.x + viewport.width ||
    bounds.y > viewport.y + viewport.height
  )
    return undefined;
  // Uniform camera transforms preserve a proven canonical interior. If the entire
  // feature remains visible, its largest valid component cannot have changed.
  if (geometry.mode === 'retained' && geometry.canonicalAnchor) {
    const b = geometry.bounds;
    const visibleBounds = {
      x: b.x * a.k + a.tx,
      y: b.y * a.k + a.ty,
      width: b.width * a.k,
      height: b.height * a.k,
    };
    if (boxWithin(visibleBounds, viewport)) return transform(geometry.canonicalAnchor, a);
  }
  const transformed = (geometry.components ?? []).map((component) => ({
    ...component,
    exterior: component.exterior.map((p) => transform(p, a)),
    holes: component.holes.map((ring) => ring.map((p) => transform(p, a))),
  }));
  let incompleteFill = false;
  const visible = transformed.flatMap((component) =>
    clipGeoLabelComponent(component, viewport, (message) => {
      incompleteFill = true;
      onIssue(message, false);
    }).map((clipped, index) => ({ clipped, original: component.index, index })),
  );
  if (incompleteFill) return undefined;
  visible.sort(
    (x, y) =>
      componentArea(y.clipped) - componentArea(x.clipped) ||
      x.original - y.original ||
      x.index - y.index,
  );
  const workBudget = { remaining: 500_000 };
  for (const { clipped } of visible) {
    const anchor = findInteriorAnchor(clipped, {
      fillComponents: transformed,
      workBudget,
      onDiagnostic: (message) => onIssue(message, true),
    });
    if (anchor) return anchor;
    if (workBudget.remaining <= 0) break;
  }
  return undefined;
}
function boxes(candidate: GeoLabelCandidate, anchor: Point): Rect[] {
  const { width: w, height: h } = candidate.block;
  const radius = Math.max(0, candidate.anchorRadius ?? 0);
  const gap = radius + 5;
  const centered = { x: anchor.x - w / 2, y: anchor.y - h / 2, width: w, height: h };
  const positions = [
    centered,
    { ...centered, x: anchor.x + gap },
    { ...centered, x: anchor.x - w - gap },
    { ...centered, y: anchor.y - h - gap },
    { ...centered, y: anchor.y + gap },
    { ...centered, x: anchor.x + gap, y: anchor.y - h - gap },
    { ...centered, x: anchor.x - w - gap, y: anchor.y - h - gap },
    { ...centered, x: anchor.x + gap, y: anchor.y + gap },
    { ...centered, x: anchor.x - w - gap, y: anchor.y + gap },
  ];
  if (candidate.kind === 'callout') positions.push(positions.shift()!);
  if (candidate.offset)
    positions.unshift({
      ...centered,
      x: anchor.x + candidate.offset.dx,
      y: anchor.y + candidate.offset.dy,
    });
  return radius > 0
    ? positions.filter((box) => {
        const x = Math.max(box.x, Math.min(anchor.x, box.x + box.width));
        const y = Math.max(box.y, Math.min(anchor.y, box.y + box.height));
        return Math.hypot(x - anchor.x, y - anchor.y) > radius + 2;
      })
    : positions;
}
/** Stateless settle/export layout. Measurements and authored inventory arrive precompiled. */
export function resolveGeoOverlay(input: GeoLabelsInput, affine: GeoLabelAffine): GeoLabelOverlay {
  const output: GeoLabelOverlay = {
    labels: [],
    leaders: [],
    markers: [],
    notes: [],
    inventory: input.candidates.map((c) => ({
      id: c.id,
      kind: c.kind,
      anchor: c.anchor,
      text: c.text,
      ...(c.subtitle !== undefined ? { subtitle: c.subtitle } : {}),
      visibility: 'unresolved',
      presentation: 'none',
    })),
  };
  const reported = new Set<string>();
  const report = (code: string, message: string, severity: 'warning' | 'error' = 'warning') => {
    if (reported.has(code)) return;
    reported.add(code);
    (output.diagnostics ??= []).push({
      code,
      message,
      severity,
      status: 'uncheckable',
      path: '/callouts',
      viewport: { width: input.viewport.width, height: input.viewport.height },
      origin: 'author',
    });
  };
  const inventory = new Map(output.inventory.map((entry) => [entry.id, entry]));
  const geometries = new Map(input.geometries.map((g) => [g.featureId, g]));
  const occupied = [...input.obstacles];
  const symbols = (input.symbolObstacles ?? []).map((symbol) => ({
    center: transform(symbol.center, affine),
    radius: symbol.radius,
  }));
  const clearsSymbols = (box: Rect) =>
    symbols.every(({ center, radius }) => {
      const dx = Math.max(box.x, Math.min(center.x, box.x + box.width)) - center.x;
      const dy = Math.max(box.y, Math.min(center.y, box.y + box.height)) - center.y;
      return dx * dx + dy * dy > (radius + 2) * (radius + 2);
    });
  const ordered = [...input.candidates].sort(
    (a, b) =>
      (a.kind === 'callout' ? 0 : 1) - (b.kind === 'callout' ? 0 : 1) ||
      b.priority - a.priority ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let text = 0;
  let callouts = 0;
  const validAffine =
    Number.isFinite(affine.k) &&
    affine.k > 0 &&
    Number.isFinite(affine.tx) &&
    Number.isFinite(affine.ty);
  for (const candidate of ordered) {
    const entry = inventory.get(candidate.id)!;
    const geometry =
      candidate.geometryId === undefined ? undefined : geometries.get(candidate.geometryId);
    let anchor: Point | undefined;
    const note = () => {
      if (candidate.kind !== 'callout' || candidate.noteSlot === undefined) return;
      const slot = input.noteSlots[candidate.noteSlot];
      if (!slot) {
        report(
          'GEO_CALLOUT_NOTE_CAPACITY',
          'A complete callout cannot fit its authored note capacity; its full text remains in the accessible inventory.',
          'error',
        );
        return;
      }
      output.notes.push({ id: candidate.id, slot });
      entry.presentation = 'note';
      if (anchor) {
        const radius = input.markerRadius ?? 7;
        const bounds = {
          x: anchor.x - radius,
          y: anchor.y - radius,
          width: radius * 2,
          height: radius * 2,
        };
        if (
          boxWithin(bounds, input.viewport) &&
          clearsSymbols(bounds) &&
          occupied.every((rect) => !overlaps(bounds, rect))
        ) {
          output.markers.push({ id: candidate.id, anchor, number: slot.number });
          occupied.push(bounds);
        }
      }
    };
    const overLimit =
      candidate.kind === 'text'
        ? text++ >= GEO_TEXT_CANDIDATE_LIMIT
        : callouts++ >= GEO_CALLOUT_CANDIDATE_LIMIT;
    if (
      (candidate.minZoom !== undefined && affine.k < candidate.minZoom) ||
      (candidate.maxZoom !== undefined && affine.k > candidate.maxZoom)
    ) {
      entry.visibility = 'zoom-range';
      continue;
    }
    if (overLimit) {
      entry.visibility = 'geometry-budget';
      entry.limitation = 'candidate-limit';
      report(
        candidate.kind === 'text' ? 'GEO_LABEL_CANDIDATE_LIMIT' : 'GEO_CALLOUT_CANDIDATE_LIMIT',
        candidate.kind === 'text'
          ? 'The map text candidate limit is 200; all omitted names remain in the accessible inventory.'
          : 'The map callout visual-work limit is 128; overflow callouts use their complete fixed note slots.',
      );
      note();
      continue;
    }
    if (!validAffine) {
      note();
      continue;
    }
    if (geometry?.captureLimited && !geometry.canonicalAnchor) {
      entry.visibility = 'geometry-budget';
      entry.limitation = 'vertex-limit';
      report(
        'GEO_LABEL_CAPTURE_LIMIT',
        'A single feature exceeds the bounded transient polygon capture budget; its full text remains in the inventory and bounded streaming probes could not prove an interior, so no anchor is drawn.',
      );
      note();
      continue;
    }
    if (geometry?.mode === 'fallback') {
      entry.limitation = 'vertex-limit';
      report(
        'GEO_LABEL_VERTEX_LIMIT',
        'The retained polygon vertex budget was exceeded; validated canonical anchors cannot switch to alternate visible components.',
      );
    }
    if (geometry?.searchLimited) {
      entry.limitation = 'search-limit';
      report(
        'GEO_LABEL_SEARCH_LIMIT',
        'The bounded polygon interior search reached its work limit; only proven interior anchors are used.',
      );
    }
    let geometryIssue = false;
    anchor = geometry
      ? visibleAnchor(geometry, affine, input.viewport, (message, searchLimit) => {
          geometryIssue = true;
          if (searchLimit) entry.limitation = 'search-limit';
          report(searchLimit ? 'GEO_LABEL_SEARCH_LIMIT' : 'GEO_LABEL_GEOMETRY_UNRESOLVED', message);
        })
      : candidate.resolvedAnchor
        ? transform(candidate.resolvedAnchor, affine)
        : undefined;
    if (!anchor || !finite(anchor)) {
      entry.visibility = geometryIssue
        ? 'unresolved'
        : geometry?.mode === 'retained'
          ? 'offscreen'
          : 'unresolved';
      note();
      continue;
    }
    if (!within(anchor, input.viewport)) {
      entry.visibility = 'offscreen';
      note();
      continue;
    }
    const placement = boxes(candidate, anchor).find(
      (box) =>
        boxWithin(box, input.viewport) &&
        clearsSymbols(box) &&
        !occupied.some((obstacle) => overlaps(box, obstacle)),
    );
    if (!placement) {
      entry.visibility = 'collision';
      note();
      continue;
    }
    output.labels.push({ id: candidate.id, anchor, bounds: placement, block: candidate.block });
    occupied.push(placement);
    entry.visibility = 'visible';
    entry.presentation = 'label';
    const to = {
      x: Math.max(placement.x, Math.min(anchor.x, placement.x + placement.width)),
      y: Math.max(placement.y, Math.min(anchor.y, placement.y + placement.height)),
    };
    if (candidate.kind === 'callout' || Math.hypot(to.x - anchor.x, to.y - anchor.y) > 2)
      output.leaders.push({ id: candidate.id, from: anchor, to });
  }
  return output;
}
