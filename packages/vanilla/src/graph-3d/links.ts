/**
 * Per-link three.js objects.
 *
 * Same reason as `nodes.ts`: `linkOpacity` is a single global number in
 * 3d-force-graph, so per-edge hover dimming needs each link to own its
 * material. (An rgba `linkColor` IS honoured for per-link opacity — see
 * `../graph-3d/README` notes in the RFC report — but changing it only takes
 * effect on a `refresh()`, which rebuilds every link object. That is exactly
 * what hover must not do.)
 *
 * Two shapes: a `Line` (constant screen width, cheap) and a cylinder `Mesh`
 * (true world-space width, needed when `edgeWidth` is encoded). Above
 * `LINK_WIDTH_MAX_EDGES` the mount stays on lines and maps `edgeWidth` to a
 * resting alpha instead.
 *
 * Positioning: three-forcegraph's own tick loop positions custom `Line` and
 * `Mesh` link objects generically (it branches on `obj.type` and, for meshes,
 * on the geometry already being a `CylinderGeometry`). The mount still installs
 * a `linkPositionUpdate` because dashed lines need `computeLineDistances()`
 * after every move, which the library's path does not call.
 */

import type { CompiledGraphEdge } from '@opendata-ai/openchart-engine';
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
} from 'three';

/** Above this edge count `edgeWidth` maps to opacity steps, not cylinder radius. */
export const LINK_WIDTH_MAX_EDGES = 2000;
/** Cylinder tessellation for width-encoded edges. */
const CYLINDER_SEGMENTS = 6;
/** Dash geometry in world units for `edgeStyle: 'dashed' | 'dotted'`. */
const DASH = { dashed: { dash: 6, gap: 4 }, dotted: { dash: 1.5, gap: 3 } };

/** A link's scene object plus the resources the mount must dispose. */
export interface LinkObject3D {
  object: Line | Mesh;
  geometry: BufferGeometry | CylinderGeometry;
  material: LineBasicMaterial | LineDashedMaterial | MeshLambertMaterial;
  /** True when the material needs `computeLineDistances()` after every move. */
  dashed: boolean;
}

/**
 * Build the scene object for one compiled edge.
 *
 * @param useWidth - Render a cylinder of `edge.strokeWidth` instead of a line.
 * @param restingAlpha - Starting material opacity (the emphasis pass retargets it).
 */
export function createLinkObject(
  edge: CompiledGraphEdge,
  useWidth: boolean,
  restingAlpha: number,
): LinkObject3D {
  if (useWidth) {
    const r = Math.max(edge.strokeWidth, 0.1) / 2;
    const geometry = new CylinderGeometry(r, r, 1, CYLINDER_SEGMENTS, 1, false);
    // Match the library's cylinder convention: origin at the start point,
    // length along +z, so its tick loop can position with scale.z + lookAt.
    geometry.applyMatrix4(new Matrix4().makeTranslation(0, 0.5, 0));
    geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
    const material = new MeshLambertMaterial({
      color: edge.stroke,
      transparent: true,
      opacity: restingAlpha,
      depthWrite: false,
    });
    return { object: new Mesh(geometry, material), geometry, material, dashed: false };
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(2 * 3), 3));
  const dashed = edge.style === 'dashed' || edge.style === 'dotted';
  const material = dashed
    ? new LineDashedMaterial({
        color: edge.stroke,
        transparent: true,
        opacity: restingAlpha,
        depthWrite: false,
        dashSize: DASH[edge.style as 'dashed' | 'dotted'].dash,
        gapSize: DASH[edge.style as 'dashed' | 'dotted'].gap,
      })
    : new LineBasicMaterial({
        color: edge.stroke,
        transparent: true,
        opacity: restingAlpha,
        depthWrite: false,
      });
  return { object: new Line(geometry, material), geometry, material, dashed };
}

/**
 * Write a straight segment into a line link's position buffer.
 *
 * Returns true when it handled the object (the mount reports that back to
 * `linkPositionUpdate` so the library skips its own pass); false for cylinder
 * meshes, which the library positions correctly on its own.
 */
export function updateLinkPosition(
  obj: LinkObject3D,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): boolean {
  if (!(obj.object instanceof Line)) return false;
  const attr = obj.geometry.getAttribute('position') as BufferAttribute;
  const a = attr.array as Float32Array;
  a[0] = start.x;
  a[1] = start.y || 0;
  a[2] = start.z || 0;
  a[3] = end.x;
  a[4] = end.y || 0;
  a[5] = end.z || 0;
  attr.needsUpdate = true;
  obj.geometry.computeBoundingSphere();
  // A dashed material renders nothing until line distances exist, and they go
  // stale on every tick because the endpoints move.
  if (obj.dashed) (obj.object as Line).computeLineDistances();
  return true;
}

/** Dispose every GPU resource this link object owns. */
export function disposeLinkObject(obj: LinkObject3D): void {
  obj.geometry.dispose();
  obj.material.dispose();
}

/**
 * Resting alpha per edge when `edgeWidth` is encoded but the graph is too big
 * for cylinders: map the compiled stroke width onto four opacity steps between
 * `min` and 1. Quantized so a hairball reads as tiers rather than noise.
 */
export function widthAsAlpha(edges: CompiledGraphEdge[], min = 0.15): Map<number, number> {
  const out = new Map<number, number>();
  if (edges.length === 0) return out;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const e of edges) {
    if (e.strokeWidth < lo) lo = e.strokeWidth;
    if (e.strokeWidth > hi) hi = e.strokeWidth;
  }
  const span = hi - lo;
  for (let i = 0; i < edges.length; i++) {
    const t = span > 0 ? (edges[i].strokeWidth - lo) / span : 1;
    const step = Math.round(t * 3) / 3;
    out.set(i, min + (1 - min) * step);
  }
  return out;
}
