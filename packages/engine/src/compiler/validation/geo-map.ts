/** Geographic map spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { checkMapSchemeName } from './helpers';

// ---------------------------------------------------------------------------
// Map validation
// ---------------------------------------------------------------------------

/** `geo.zoom`: boolean, or `{ maxZoom?: number >= 1, controls?: boolean }`. */
function validateGeoMapZoom(zoom: unknown, errors: ValidationError[]): void {
  if (zoom === undefined || typeof zoom === 'boolean') return;
  if (typeof zoom !== 'object' || zoom === null || Array.isArray(zoom)) {
    errors.push({
      message: 'Spec error: geo.zoom must be a boolean or an object { maxZoom?, controls? }',
      path: '/geo/zoom',
      code: 'INVALID_TYPE',
      suggestion: 'Use zoom: true, or zoom: { maxZoom: 8, controls: true }',
    });
    return;
  }
  const cfg = zoom as Record<string, unknown>;
  if (
    cfg.maxZoom !== undefined &&
    (typeof cfg.maxZoom !== 'number' || !Number.isFinite(cfg.maxZoom) || cfg.maxZoom < 1)
  ) {
    errors.push({
      message: 'Spec error: geo.zoom.maxZoom must be a number >= 1',
      path: '/geo/zoom/maxZoom',
      code: 'INVALID_VALUE',
      suggestion: 'maxZoom is a multiple of the full map, e.g. maxZoom: 8. The default is 12.',
    });
  }
  if (cfg.controls !== undefined && typeof cfg.controls !== 'boolean') {
    errors.push({
      message: 'Spec error: geo.zoom.controls must be a boolean',
      path: '/geo/zoom/controls',
      code: 'INVALID_TYPE',
      suggestion: 'Use controls: false to hide the zoom buttons',
    });
  }
}

export function validateGeoMapSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  if (!spec.geo || typeof spec.geo !== 'object') {
    errors.push({
      message: 'Spec error: map spec requires a "geo" object with a TopoJSON "features" field',
      path: '/geo',
      code: 'MISSING_FIELD',
      suggestion: 'Add a geo object, e.g. geo: { features: topoJsonData, projection: "identity" }',
    });
    return;
  }

  const geo = spec.geo as Record<string, unknown>;
  if (!geo.features) {
    errors.push({
      message: 'Spec error: geo requires a "features" field containing TopoJSON topology',
      path: '/geo/features',
      code: 'MISSING_FIELD',
      suggestion:
        'Import a TopoJSON file and pass it as geo.features, e.g. import topo from "us-atlas/states-albers-10m.json"',
    });
    return;
  }

  if (!spec.encoding || typeof spec.encoding !== 'object') {
    errors.push({
      message: 'Spec error: map spec requires an "encoding" object with key and color channels',
      path: '/encoding',
      code: 'MISSING_FIELD',
      suggestion:
        'Add an encoding object, e.g. encoding: { key: { field: "id", type: "nominal" }, color: { field: "value", type: "quantitative" } }',
    });
    return;
  }

  // Map color channels resolve scale.scheme against the sequential palettes
  // with a silent blue fallback; reject unsupported names here instead.
  const mapEncoding = spec.encoding as Record<string, unknown>;
  if (mapEncoding.color && typeof mapEncoding.color === 'object') {
    checkMapSchemeName(mapEncoding.color as Record<string, unknown>, ['encoding', 'color'], errors);
  }
  if (spec.points && typeof spec.points === 'object') {
    const pointsLayer = spec.points as Record<string, unknown>;
    if (pointsLayer.color && typeof pointsLayer.color === 'object') {
      checkMapSchemeName(pointsLayer.color as Record<string, unknown>, ['points', 'color'], errors);
    }
  }

  // Validate geo.focus if present
  if ('focus' in geo && geo.focus !== undefined && geo.focus !== null) {
    const focus = geo.focus;
    if (typeof focus === 'string' || typeof focus === 'number') {
      // valid: single id
    } else if (Array.isArray(focus)) {
      for (let i = 0; i < focus.length; i++) {
        if (typeof focus[i] !== 'string' && typeof focus[i] !== 'number') {
          errors.push({
            message: `Spec error: geo.focus array element [${i}] must be a string or number`,
            path: jsonPointer('geo', 'focus', i),
            code: 'INVALID_TYPE',
            suggestion: 'Each element in the focus array should be a feature id (string or number)',
          });
        }
      }
    } else if (typeof focus === 'object') {
      const focusObj = focus as Record<string, unknown>;
      if ('points' in focusObj) {
        // Points form: { points: true | { field, value }, padding? } fits the
        // point layer's cluster (all points, or a matching subset).
        const pts = focusObj.points;
        const isSubset =
          typeof pts === 'object' &&
          pts !== null &&
          typeof (pts as Record<string, unknown>).field === 'string' &&
          'value' in (pts as Record<string, unknown>);
        if (pts !== true && !isSubset) {
          errors.push({
            message:
              'Spec error: geo.focus.points must be true or { field: string, value: string | number }',
            path: '/geo/focus/points',
            code: 'INVALID_TYPE',
            suggestion:
              'Use { points: true } to fit all points, or { points: { field: "rating", value: "F" } } to fit a subset.',
          });
        }
        if (focusObj.padding !== undefined && typeof focusObj.padding !== 'number') {
          errors.push({
            message: 'Spec error: geo.focus.padding must be a number',
            path: '/geo/focus/padding',
            code: 'INVALID_TYPE',
            suggestion: 'Provide padding as a number in map-local units, e.g. padding: 16',
          });
        }
      } else if (!('features' in focusObj) || focusObj.features == null) {
        errors.push({
          message: 'Spec error: geo.focus object must have a "features" or "points" property',
          path: '/geo/focus/features',
          code: 'MISSING_FIELD',
          suggestion:
            'Provide feature id(s) to focus on, e.g. { features: "36", padding: 32 }, or { points: true } to fit the point cluster.',
        });
      } else {
        const feats = focusObj.features;
        if (typeof feats !== 'string' && typeof feats !== 'number' && !Array.isArray(feats)) {
          errors.push({
            message:
              'Spec error: geo.focus.features must be a string, number, or array of strings/numbers',
            path: '/geo/focus/features',
            code: 'INVALID_TYPE',
            suggestion: 'Use a feature id or array of ids, e.g. "36" or ["36", "34"]',
          });
        } else if (Array.isArray(feats)) {
          for (let i = 0; i < feats.length; i++) {
            if (typeof feats[i] !== 'string' && typeof feats[i] !== 'number') {
              errors.push({
                message: `Spec error: geo.focus.features[${i}] must be a string or number`,
                path: jsonPointer('geo', 'focus', 'features', i),
                code: 'INVALID_TYPE',
                suggestion: 'Each element should be a feature id (string or number)',
              });
            }
          }
        }
        if (focusObj.padding !== undefined && typeof focusObj.padding !== 'number') {
          errors.push({
            message: 'Spec error: geo.focus.padding must be a number',
            path: '/geo/focus/padding',
            code: 'INVALID_TYPE',
            suggestion: 'Provide padding as a number in map-local units, e.g. padding: 32',
          });
        }
      }
    } else {
      errors.push({
        message:
          'Spec error: geo.focus must be a string, number, array of ids, or object with { features, padding? } or { points: true, padding? }',
        path: '/geo/focus',
        code: 'INVALID_TYPE',
        suggestion:
          'Use a feature id, array of ids, { features: "36", padding: 16 }, or { points: true }. Pass null to clear focus.',
      });
    }
  }

  validateGeoMapZoom(geo.zoom, errors);

  const encoding = spec.encoding as Record<string, unknown>;
  const hasPoints = spec.points && typeof spec.points === 'object' && !Array.isArray(spec.points);

  // key is required unless basemap-only mode (points present + empty/no choropleth data)
  const specData = spec.data as unknown[] | undefined;
  const isBasemapOnly = hasPoints && (!specData || specData.length === 0);
  const keyCh = encoding.key as Record<string, unknown> | undefined;
  if (!isBasemapOnly) {
    if (!keyCh || typeof keyCh !== 'object') {
      errors.push({
        message: 'Spec error: map encoding requires "key" channel',
        path: '/encoding/key',
        code: 'MISSING_FIELD',
        suggestion: 'Add encoding.key, e.g. key: { field: "id", type: "nominal" }',
      });
    } else if (!keyCh.field || typeof keyCh.field !== 'string') {
      errors.push({
        message: 'Spec error: encoding.key must have a "field" string',
        path: '/encoding/key/field',
        code: 'MISSING_FIELD',
        suggestion: 'Add a field name, e.g. key: { field: "id" }',
      });
    }
  }

  // color is required UNLESS points is present (basemap-only mode)
  const colorCh = encoding.color as Record<string, unknown> | undefined;
  if (!hasPoints) {
    if (!colorCh || typeof colorCh !== 'object') {
      errors.push({
        message:
          'Spec error: map encoding requires "color" channel (or add a "points" layer for basemap-only mode)',
        path: '/encoding/color',
        code: 'MISSING_FIELD',
        suggestion: 'Add encoding.color, e.g. color: { field: "value", type: "quantitative" }',
      });
    } else if (!colorCh.field || typeof colorCh.field !== 'string') {
      errors.push({
        message: 'Spec error: encoding.color must have a "field" string',
        path: '/encoding/color/field',
        code: 'MISSING_FIELD',
        suggestion: 'Add a field name, e.g. color: { field: "value" }',
      });
    }
  } else if (
    colorCh &&
    typeof colorCh === 'object' &&
    (!colorCh.field || typeof colorCh.field !== 'string')
  ) {
    errors.push({
      message: 'Spec error: encoding.color must have a "field" string when provided',
      path: '/encoding/color/field',
      code: 'MISSING_FIELD',
      suggestion: 'Add a field name, e.g. color: { field: "value" }',
    });
  }

  // Validate points layer if present
  if (hasPoints) {
    const points = spec.points as Record<string, unknown>;
    if (!Array.isArray(points.data)) {
      errors.push({
        message: 'Spec error: points.data must be an array of data rows',
        path: '/points/data',
        code: 'INVALID_TYPE',
        suggestion: 'Provide data as an array of objects with lat/lng fields',
      });
    }
    for (const ch of ['longitude', 'latitude'] as const) {
      const enc = points[ch] as Record<string, unknown> | undefined;
      if (!enc || typeof enc !== 'object') {
        errors.push({
          message: `Spec error: points requires "${ch}" encoding channel`,
          path: jsonPointer('points', ch),
          code: 'MISSING_FIELD',
          suggestion: `Add points.${ch}, e.g. ${ch}: { field: "${ch === 'longitude' ? 'lon' : 'lat'}", type: "quantitative" }`,
        });
      } else if (!enc.field || typeof enc.field !== 'string') {
        errors.push({
          message: `Spec error: points.${ch} must have a "field" string`,
          path: jsonPointer('points', ch, 'field'),
          code: 'MISSING_FIELD',
          suggestion: `Add a field name, e.g. ${ch}: { field: "${ch === 'longitude' ? 'lon' : 'lat'}" }`,
        });
      }
    }
    for (const ch of ['size', 'color', 'key'] as const) {
      const enc = points[ch] as Record<string, unknown> | undefined;
      if (enc && typeof enc === 'object' && (!enc.field || typeof enc.field !== 'string')) {
        errors.push({
          message: `Spec error: points.${ch} must have a "field" string when provided`,
          path: jsonPointer('points', ch, 'field'),
          code: 'MISSING_FIELD',
          suggestion: `Add a field name, e.g. ${ch}: { field: "myField" }`,
        });
      }
    }
  }
}
