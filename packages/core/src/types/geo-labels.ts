/** Portable, measured map-label payload. All coordinates are map-local CSS pixels. */
import type { DesignDiagnostic } from './design';
import type { Point, Rect, TextStyle } from './layout';
import type { GeoAnchor } from './spec';

export interface GeoTextBlock {
  width: number;
  height: number;
  /** Baselines relative to the block's top-left corner. */
  lines: Array<{ text: string; x: number; y: number; style: TextStyle }>;
}
export interface GeoLabelComponent {
  index: number;
  exterior: Point[];
  holes: Point[][];
  /** Original SVG nonzero-fill orientation, preserved through normalized storage. */
  winding?: number;
  holeWindings?: number[];
}
export interface GeoLabelGeometry {
  featureId: string;
  bounds: Rect;
  canonicalAnchor?: Point;
  components?: GeoLabelComponent[];
  vertexCount: number;
  mode: 'retained' | 'fallback' | 'unresolved';
  searchLimited?: boolean;
  captureLimited?: boolean;
}
export interface GeoLabelCandidate {
  /** Stable tagged identity, distinct from authored callout and entity IDs. */
  id: string;
  kind: 'text' | 'callout';
  anchor: GeoAnchor;
  text: string;
  subtitle?: string;
  priority: number;
  block: GeoTextBlock;
  /** Projected point/coordinate anchor; feature anchors use geometryId. */
  resolvedAnchor?: Point;
  /** Constant-screen radius of an anchored quantitative symbol. */
  anchorRadius?: number;
  geometryId?: string;
  minZoom?: number;
  maxZoom?: number;
  offset?: { dx: number; dy: number };
  /** Stable index into the premeasured authored callout note slots. */
  noteSlot?: number;
}
export interface GeoCalloutNoteSlot {
  id: string;
  number: number;
  bounds: Rect;
  block: GeoTextBlock;
}
export type GeoLabelVisibility =
  | 'visible'
  | 'collision'
  | 'zoom-range'
  | 'offscreen'
  | 'unresolved'
  | 'geometry-budget';
export interface GeoLabelInventoryEntry {
  id: string;
  kind: 'text' | 'callout';
  anchor: GeoAnchor;
  text: string;
  subtitle?: string;
  visibility: GeoLabelVisibility;
  presentation: 'label' | 'note' | 'none';
  limitation?: 'candidate-limit' | 'vertex-limit' | 'search-limit';
}
export interface GeoPlacedLabel {
  id: string;
  anchor: Point;
  bounds: Rect;
  block: GeoTextBlock;
}
export interface GeoLabelOverlay {
  diagnostics?: DesignDiagnostic[];
  labels: GeoPlacedLabel[];
  leaders: Array<{ id: string; from: Point; to: Point }>;
  markers: Array<{ id: string; anchor: Point; number: number }>;
  notes: Array<{ id: string; slot: GeoCalloutNoteSlot }>;
  inventory: GeoLabelInventoryEntry[];
}
export interface GeoLabelsInput {
  /** Complete inventory source, including candidates beyond the visual cap. */
  candidates: GeoLabelCandidate[];
  geometries: GeoLabelGeometry[];
  viewport: Rect;
  obstacles: Rect[];
  /** Measured screen radius for fallback note markers. */
  markerRadius?: number;
  /** Base-map centers with constant-screen quantitative symbol radii. */
  symbolObstacles?: Array<{ center: Point; radius: number }>;
  noteSlots: GeoCalloutNoteSlot[];
}
export interface GeoLabelsBundle extends GeoLabelsInput {
  initialOverlay: GeoLabelOverlay;
}
export interface GeoLabelAffine {
  k: number;
  tx: number;
  ty: number;
}
