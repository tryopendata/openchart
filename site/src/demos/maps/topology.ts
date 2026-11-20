/**
 * Shrinks an atlas TopoJSON file to what one map demo draws. A spec carries its
 * topology inline, and a demo page embeds each spec more than once (the spec the
 * live mount reads, and a static SVG per theme drawn from it), so a full atlas
 * file per demo would outgrow the page. The reduction keeps one object and the
 * geometries the map shows, drops islands too small to see, simplifies every
 * arc, and drops the arcs nothing uses any more. Arcs are simplified whole, with
 * their end points kept, so neighboring shapes still share their borders.
 */
import { quantize } from "topojson-client";
import type {
  GeometryCollection,
  MultiPolygon,
  Objects,
  Polygon,
  Topology,
} from "topojson-specification";
import { type Point, ringArea, simplifyLine } from "./plane-geometry";

/** An atlas topology as us-atlas and world-atlas ship it: quantized, delta-encoded arcs. */
export type AtlasTopology = {
  type: "Topology";
  transform: { scale: number[]; translate: number[] };
  arcs: number[][][];
  objects: Record<string, { type: string; geometries: AtlasGeometry[] }>;
};

/** One area in an atlas object. Both atlases store areas as polygons or multipolygons. */
export type AtlasGeometry = (Polygon | MultiPolygon) & {
  id?: string | number;
  properties?: Record<string, unknown>;
};

/** How `coarsenTopology` reduces an atlas. */
export type CoarsenOptions = {
  /** The atlas object to keep, such as "states" or "countries". */
  object: string;
  /** Which geometries to keep. Default: all of them. */
  keep?: (geometry: AtlasGeometry) => boolean;
  /** Largest distance, in degrees, a dropped point may lie from the simplified line. */
  tolerance: number;
  /** Polygons smaller than this, in square degrees, are dropped, except each geometry's largest. */
  minArea: number;
};

/** Points per side of the grid the result is quantized to; fine enough to hide the grid. */
const GRID_SIZE = 10_000;

/** The arcs in longitude and latitude, undoing the atlas's quantization and delta encoding. */
function decodeArcs(atlas: AtlasTopology): Point[][] {
  const [scaleX = 1, scaleY = 1] = atlas.transform.scale;
  const [shiftX = 0, shiftY = 0] = atlas.transform.translate;
  return atlas.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx = 0, dy = 0]) => {
      x += dx;
      y += dy;
      return [x * scaleX + shiftX, y * scaleY + shiftY];
    });
  });
}

/** A negative arc index means the arc reversed: ~index is the arc it points at. */
const arcOf = (index: number) => (index < 0 ? ~index : index);

/** The points of a ring, joining its arcs in order and in their stated direction. */
function ringPoints(ring: number[], arcs: Point[][]): Point[] {
  return ring.flatMap((index, position) => {
    const arc = arcs[arcOf(index)] ?? [];
    const directed = index < 0 ? [...arc].reverse() : arc;
    // Each arc starts where the previous one ended, so that point is listed once.
    return position === 0 ? directed : directed.slice(1);
  });
}

/** The geometry as a list of polygons, each a list of rings. */
function polygonsOf(geometry: AtlasGeometry): number[][][] {
  return geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
}

/** The geometry without polygons under `minArea`, always keeping its largest polygon. */
function dropSmallPolygons(geometry: AtlasGeometry, arcs: Point[][], minArea: number) {
  const polygons = polygonsOf(geometry);
  const areas = polygons.map(([outer = []]) => ringArea(ringPoints(outer, arcs)));
  const largest = Math.max(...areas);
  const kept = polygons.filter((_, index) => {
    const area = areas[index] ?? 0;
    return area >= minArea || area === largest;
  });
  const { arcs: _dropped, type: _type, ...rest } = geometry;
  return kept.length === 1
    ? { ...rest, type: "Polygon" as const, arcs: kept[0] ?? [] }
    : { ...rest, type: "MultiPolygon" as const, arcs: kept };
}

/**
 * How many points each arc must keep so every ring it is part of stays an
 * area. A ring that collapses to a line has no inside, and the map projection
 * then reads it as covering the whole globe. A ring of one arc (an island) needs
 * four points besides its repeated end, a ring of two arcs needs a point between
 * the ends of each, and a ring of three or more arcs is a polygon with its ends alone.
 */
function minPointsByArc(geometries: AtlasGeometry[]): Map<number, number> {
  const minPoints = new Map<number, number>();
  for (const ring of geometries.flatMap((geometry) => polygonsOf(geometry).flat())) {
    const needed = ring.length === 1 ? 5 : ring.length === 2 ? 3 : 2;
    for (const arc of ring.map(arcOf)) {
      minPoints.set(arc, Math.max(needed, minPoints.get(arc) ?? 2));
    }
  }
  return minPoints;
}

/**
 * The arc simplified, with the tolerance halved until at least `minPoints`
 * points remain. An arc with too few points to begin with stays as it is.
 */
function simplifyArc(arc: Point[], tolerance: number, minPoints: number): Point[] {
  if (arc.length <= minPoints) return arc;
  for (let current = tolerance; current > tolerance / 64; current /= 2) {
    const simplified = simplifyLine(arc, current);
    if (simplified.length >= minPoints) return simplified;
  }
  return arc;
}

/** Renumbers a geometry's arc indexes through `renumber`, keeping each arc's direction. */
function renumberArcs(geometry: AtlasGeometry, renumber: Map<number, number>): AtlasGeometry {
  const ring = (indexes: number[]) =>
    indexes.map((index) => {
      const next = renumber.get(arcOf(index)) ?? 0;
      return index < 0 ? ~next : next;
    });
  return geometry.type === "Polygon"
    ? { ...geometry, arcs: geometry.arcs.map(ring) }
    : { ...geometry, arcs: geometry.arcs.map((polygon) => polygon.map(ring)) };
}

/**
 * A copy of one object of `atlas`, reduced for a demo: only the kept
 * geometries, no polygons under `minArea`, arcs simplified to `tolerance`, and
 * only the arcs still in use.
 *
 * @throws {Error} When the atlas has no object named `options.object`.
 */
export function coarsenTopology(atlas: AtlasTopology, options: CoarsenOptions): Topology {
  const source = atlas.objects[options.object];
  if (!source) {
    const names = Object.keys(atlas.objects).join(", ");
    throw new Error(`The atlas has no object "${options.object}". It has: ${names}.`);
  }
  const decoded = decodeArcs(atlas);
  const geometries = source.geometries
    .filter(options.keep ?? (() => true))
    .map((geometry) => dropSmallPolygons(geometry, decoded, options.minArea));
  const used = [
    ...new Set(geometries.flatMap((geometry) => polygonsOf(geometry).flat(2).map(arcOf))),
  ];
  const renumber = new Map(used.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const minPoints = minPointsByArc(geometries);
  const collection: GeometryCollection = {
    type: "GeometryCollection",
    geometries: geometries.map((geometry) => renumberArcs(geometry, renumber)),
  };
  const simplified: Topology<Objects> = {
    type: "Topology",
    arcs: used.map((index) =>
      simplifyArc(decoded[index] ?? [], options.tolerance, minPoints.get(index) ?? 2),
    ),
    objects: { [options.object]: collection },
  };
  return quantize(simplified, GRID_SIZE);
}
