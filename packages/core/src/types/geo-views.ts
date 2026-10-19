import type { GeoLabelsBundle, GeoTextBlock } from './geo-labels';
import type {
  GeoMapBorders,
  GeoMapFeatureMark,
  GeoMapFocusLayout,
  GeoMapPointMark,
  Rect,
} from './layout';
import type { GeoMapProjection } from './spec';

/** Context geometry uses the primary view's immutable fitted projection. */
export interface GeoDetailLayer {
  id: string;
  features: unknown;
  objectKey?: string;
  minZoom: number;
  maxZoom?: number;
  /** Assertion that decoded identity coordinates share the primary source plane. */
  sourcePlane?: string;
}
export interface GeoInset {
  id: string;
  label: string;
  /** Canonical topology feature IDs, independent of the geo.idField data-join field. */
  featureIds: Array<string | number>;
  placement: 'bottom-left' | 'bottom-right';
  width: number;
  projection?: GeoMapProjection;
  /** Defaults true; false explicitly duplicates primary feature coverage. */
  removeFromMain?: boolean;
  /** Explicit existing points.key values; omission includes no points. */
  pointIds?: Array<string | number>;
}
export interface GeoProjectionContext {
  projection: GeoMapProjection;
  space: 'geographic' | 'source';
  sourcePlane?: string;
  objectKey?: string;
  fitObjectKey?: string;
}
export interface GeoDetailLayerLayout {
  id: string;
  minZoom: number;
  maxZoom?: number;
  /** Unstyled, context-only paths, already projected into this view. */
  paths: string[];
}
/** Each view owns its camera; observation identity deliberately excludes viewId. */
export interface GeoViewLayout {
  viewId: string;
  /** Map-local frame and drawing viewport, including the separately measured label. */
  frame: Rect;
  viewport: Rect;
  labelBounds?: Rect;
  label?: GeoTextBlock;
  coverage?: string;
  /** Everything below is viewport-local, in CSS pixels before camera transform. */
  mapSize: { width: number; height: number };
  features: GeoMapFeatureMark[];
  borders: GeoMapBorders;
  pointMarks: GeoMapPointMark[];
  labels?: GeoLabelsBundle;
  focus: GeoMapFocusLayout | null;
  detailLayers: GeoDetailLayerLayout[];
  projectionContext: GeoProjectionContext;
}
