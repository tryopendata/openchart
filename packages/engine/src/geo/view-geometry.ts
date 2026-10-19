import type {
  GeoDetailLayer,
  GeoDetailLayerLayout,
  GeoInset,
  GeoMapGeo,
  GeoProjectionContext,
  Rect,
} from '@opendata-ai/openchart-core';
import type { GeoIdentityTransform, GeoProjection } from 'd3-geo';
import { geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature as topoFeature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { resolveDefaultProjection } from './projections';

export class GeoViewGeometryError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GeoViewGeometryError';
  }
}
function fail(code: string, message: string, context?: Record<string, unknown>): never {
  throw new GeoViewGeometryError(code, message, context);
}
export interface DecodedGeoViewSource {
  collection: FeatureCollection;
  objectKey?: string;
  topology?: Topology;
  object?: Topology['objects'][string];
}
/** Decodes each topology's quantization independently. This is not a CRS conversion. */
export function decodeGeoViewSource(input: unknown, objectKey?: string): DecodedGeoViewSource {
  if (!input || typeof input !== 'object')
    fail('GEO_VIEW_SOURCE', 'A geographic view needs a Topology or GeoJSON object.');
  const source = input as Record<string, unknown>;
  if (source.type === 'Topology') {
    const topology = input as Topology;
    const key = objectKey ?? Object.keys(topology.objects ?? {})[0];
    if (!key || !Object.hasOwn(topology.objects ?? {}, key))
      fail(
        'GEO_VIEW_OBJECT',
        `Geographic object "${key ?? ''}" is missing from the primary topology.`,
        { objectKey: key },
      );
    const object = topology.objects[key];
    const decoded = topoFeature(topology, object);
    const collection: FeatureCollection =
      decoded.type === 'FeatureCollection'
        ? decoded
        : { type: 'FeatureCollection', features: [decoded] };
    return { collection, objectKey: key, topology, object };
  }
  if (objectKey !== undefined)
    fail('GEO_VIEW_OBJECT', 'objectKey applies only to TopoJSON objects.', { objectKey });
  if (source.type === 'FeatureCollection' && Array.isArray(source.features))
    return { collection: input as FeatureCollection };
  if (source.type === 'Feature')
    return { collection: { type: 'FeatureCollection', features: [input as Feature] } };
  if (
    [
      'Polygon',
      'MultiPolygon',
      'GeometryCollection',
      'Point',
      'MultiPoint',
      'LineString',
      'MultiLineString',
    ].includes(String(source.type))
  )
    return {
      collection: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: input as Geometry }],
      },
    };
  return fail('GEO_VIEW_SOURCE', 'Unsupported geographic source type.');
}
export function resolveGeoViewSources(geo: GeoMapGeo): {
  primary: DecodedGeoViewSource;
  fit: DecodedGeoViewSource;
  context: GeoProjectionContext;
} {
  const primary = decodeGeoViewSource(geo.features, geo.objectKey);
  const fit =
    geo.fitObjectKey === undefined ? primary : decodeGeoViewSource(geo.features, geo.fitObjectKey);
  const projection = geo.projection ?? resolveDefaultProjection(geo.features);
  if (projection !== 'identity' && geo.sourcePlane !== undefined)
    fail('GEO_SOURCE_PLANE', 'sourcePlane applies only to identity source-space views.');
  return {
    primary,
    fit,
    context: {
      projection,
      space: projection === 'identity' ? 'source' : 'geographic',
      ...(geo.sourcePlane ? { sourcePlane: geo.sourcePlane } : {}),
      ...(primary.objectKey ? { objectKey: primary.objectKey } : {}),
      ...(fit.objectKey ? { fitObjectKey: fit.objectKey } : {}),
    },
  };
}
function geographicCoordinates(geometry: Geometry | null): boolean {
  if (!geometry) return true;
  if (geometry.type === 'GeometryCollection')
    return geometry.geometries.every(geographicCoordinates);
  const walk = (value: unknown): boolean => {
    if (!Array.isArray(value)) return false;
    if (typeof value[0] === 'number')
      return (
        value.length >= 2 &&
        Number.isFinite(value[0]) &&
        Number.isFinite(value[1]) &&
        Math.abs(value[0]) <= 180.5 &&
        Math.abs(value[1]) <= 90.5
      );
    return value.every(walk);
  };
  return walk(geometry.coordinates);
}
function uniqueId(id: string, used: Set<string>): void {
  if (typeof id !== 'string' || !id.trim() || id === 'root' || used.has(id))
    fail('GEO_VIEW_ID', `View/layer id "${id}" must be nonempty, unique and cannot be root.`, {
      id,
    });
  used.add(id);
}
/** The injected projection has already been fitted exactly once to primary fit geometry. */
export function projectGeoDetailLayers(
  layers: GeoDetailLayer[],
  projection: GeoProjection | GeoIdentityTransform,
  context: GeoProjectionContext,
): GeoDetailLayerLayout[] {
  const used = new Set<string>(),
    path = geoPath(projection);
  return layers.map((layer) => {
    uniqueId(layer.id, used);
    if (
      !Number.isFinite(layer.minZoom) ||
      layer.minZoom < 1 ||
      (layer.maxZoom !== undefined &&
        (!Number.isFinite(layer.maxZoom) || layer.maxZoom < layer.minZoom))
    )
      fail('GEO_DETAIL_ZOOM', 'Detail zoom bounds must be finite, at least 1 and ordered.', {
        id: layer.id,
      });
    if (context.space === 'source') {
      if (!context.sourcePlane?.trim() || layer.sourcePlane !== context.sourcePlane)
        fail(
          'GEO_SOURCE_PLANE',
          'Identity detail requires equal, nonempty primary/detail sourcePlane assertions.',
          { id: layer.id },
        );
    } else if (layer.sourcePlane !== undefined)
      fail('GEO_SOURCE_PLANE', 'Geographic detail cannot assert a preprojected source plane.', {
        id: layer.id,
      });
    const source = decodeGeoViewSource(layer.features, layer.objectKey);
    if (
      context.space === 'geographic' &&
      !source.collection.features.every((f) => geographicCoordinates(f.geometry))
    )
      fail(
        'GEO_SOURCE_PLANE',
        'Geographic detail contains coordinates outside longitude/latitude bounds.',
        { id: layer.id },
      );
    return {
      id: layer.id,
      minZoom: layer.minZoom,
      ...(layer.maxZoom !== undefined ? { maxZoom: layer.maxZoom } : {}),
      paths: source.collection.features.flatMap((feature) => {
        const d = path(feature);
        return d ? [d] : [];
      }),
    };
  });
}
export function resolveGeoInsetProjection(
  inset: GeoInset,
  context: GeoProjectionContext,
): GeoProjectionContext {
  const projection = inset.projection ?? context.projection;
  if ((context.space === 'source') !== (projection === 'identity'))
    fail(
      'GEO_INSET_PROJECTION',
      'Inset projection must preserve the primary geographic/source coordinate space.',
      { id: inset.id, projection },
    );
  return { ...context, projection };
}
export function selectGeoInsetFeatures<
  T extends { id?: string | number; properties?: Record<string, unknown> | null },
>(features: T[], insets: GeoInset[]): { root: T[]; views: Map<string, T[]> } {
  const used = new Set<string>(),
    byId = new Map<string, T[]>(),
    removed = new Set<string>(),
    views = new Map<string, T[]>();
  const featureId = (feature: T) => feature.id;
  for (const f of features)
    if (featureId(f) !== undefined) {
      const key = String(featureId(f));
      byId.set(key, [...(byId.get(key) ?? []), f]);
    }
  for (const inset of insets) {
    uniqueId(inset.id, used);
    if (!inset.label?.trim() || !inset.featureIds?.length)
      fail(
        'GEO_INSET_COVERAGE',
        'An inset needs a readable label and explicit nonempty feature coverage.',
        { id: inset.id },
      );
    const ids = new Set<string>();
    const selected = inset.featureIds.map((id) => {
      const key = String(id);
      if (ids.has(key))
        fail('GEO_INSET_REFERENCE', `Inset feature "${key}" is repeated.`, { id: inset.id });
      ids.add(key);
      const found = byId.get(key);
      if (!found?.length)
        fail('GEO_INSET_REFERENCE', `Inset feature "${key}" is missing.`, { id: inset.id });
      if (found.length !== 1)
        fail('GEO_INSET_REFERENCE', `Inset feature "${key}" is ambiguous.`, { id: inset.id });
      if (inset.removeFromMain !== false) removed.add(key);
      return found[0];
    });
    views.set(inset.id, selected);
  }
  return {
    root: features.filter((f) => featureId(f) === undefined || !removed.has(String(featureId(f)))),
    views,
  };
}
export function selectGeoInsetPoints<T extends Record<string, unknown>>(
  rows: T[],
  inset: GeoInset,
  keyField?: string,
): T[] {
  if (!inset.pointIds?.length) return [];
  if (!keyField)
    fail('GEO_INSET_POINT_KEY', 'Inset pointIds require an explicit points.key field.', {
      id: inset.id,
    });
  const byId = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[keyField];
    if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string') {
      const key = String(value);
      byId.set(key, [...(byId.get(key) ?? []), row]);
    }
  }
  const used = new Set<string>();
  return inset.pointIds.map((id) => {
    const key = String(id),
      found = byId.get(key);
    if (used.has(key)) fail('GEO_INSET_POINT_KEY', `Inset point key "${key}" is repeated.`);
    used.add(key);
    if (!found?.length) fail('GEO_INSET_POINT_KEY', `Inset point key "${key}" is missing.`);
    if (found.length !== 1) fail('GEO_INSET_POINT_KEY', `Inset point key "${key}" is ambiguous.`);
    return found[0];
  });
}
export interface GeoInsetViewport {
  viewId: string;
  frame: Rect;
  viewport: Rect;
  labelBounds: Rect;
}
export function planGeoInsetViewports(
  frame: Rect,
  entries: Array<{ inset: GeoInset; labelHeight: number }>,
  options: { gap?: number; aspectRatio?: number; minRootHeight?: number } = {},
): { rootViewport: Rect; insets: GeoInsetViewport[]; reservedHeight: number } {
  const gap = options.gap ?? 12,
    ratio = options.aspectRatio ?? 0.65,
    minRoot = options.minRootHeight ?? 48;
  if (
    ![frame.x, frame.y, frame.width, frame.height, gap, ratio, minRoot].every(Number.isFinite) ||
    frame.width <= 0 ||
    frame.height <= 0 ||
    gap < 0 ||
    ratio <= 0 ||
    minRoot <= 0
  )
    fail('GEO_INSET_SPACE', 'Inset space requires a finite positive frame and sizing options.');
  const used = new Set<string>();
  const rows: Array<{
    height: number;
    left: number;
    right: number;
    items: Array<{ entry: (typeof entries)[number]; x: number; width: number; height: number }>;
  }> = [];
  for (const entry of entries) {
    const { inset, labelHeight } = entry;
    uniqueId(inset.id, used);
    if (
      !inset.label?.trim() ||
      !Number.isFinite(labelHeight) ||
      labelHeight <= 0 ||
      !Number.isFinite(inset.width) ||
      inset.width < 32 ||
      inset.width > frame.width
    )
      fail('GEO_INSET_SPACE', 'Insufficient inset space or invalid measured label/width.', {
        id: inset.id,
      });
    let row = rows.find(
      (r) => frame.width - r.left - r.right >= inset.width + (r.items.length ? gap : 0),
    );
    if (!row) {
      row = { height: 0, left: 0, right: 0, items: [] };
      rows.push(row);
    }
    const height = inset.width * ratio + labelHeight + gap;
    const additionalGap =
      inset.placement === 'bottom-right' ? (row.right > 0 ? gap : 0) : row.left > 0 ? gap : 0;
    let x: number;
    if (inset.placement === 'bottom-right') {
      x = frame.width - row.right - inset.width - additionalGap;
      row.right += inset.width + additionalGap;
    } else if (inset.placement === 'bottom-left') {
      x = row.left + additionalGap;
      row.left += inset.width + additionalGap;
    } else fail('GEO_INSET_SPACE', 'Unknown inset placement.', { id: inset.id });
    row.items.push({ entry, x, width: inset.width, height });
    row.height = Math.max(row.height, height);
  }
  const reservedHeight = rows.reduce((sum, row) => sum + row.height + gap, 0);
  if (frame.height - reservedHeight < minRoot)
    fail(
      'GEO_INSET_SPACE',
      'Insufficient space for all authored inset views and the primary map.',
      { reservedHeight, availableHeight: frame.height },
    );
  const insets: GeoInsetViewport[] = [];
  let bottom = frame.y + frame.height;
  for (const row of rows) {
    const y = bottom - row.height;
    for (const item of row.items) {
      const labelHeight = item.entry.labelHeight;
      const f = { x: frame.x + item.x, y, width: item.width, height: row.height };
      insets.push({
        viewId: item.entry.inset.id,
        frame: f,
        labelBounds: { x: f.x, y: f.y, width: f.width, height: labelHeight },
        viewport: {
          x: f.x,
          y: f.y + labelHeight + gap,
          width: f.width,
          height: f.height - labelHeight - gap,
        },
      });
    }
    bottom = y - gap;
  }
  // Keep author order independent of shelf packing.
  const order = new Map(entries.map((e, i) => [e.inset.id, i]));
  insets.sort((a, b) => order.get(a.viewId)! - order.get(b.viewId)!);
  return {
    rootViewport: { ...frame, height: frame.height - reservedHeight },
    insets,
    reservedHeight,
  };
}
