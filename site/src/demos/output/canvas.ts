/**
 * Demos for the canvas page (docs/output/canvas): county centers computed from
 * us-atlas with d3-geo, drawn as longitude and latitude scatters. The counties
 * west of the 100th meridian ask for the canvas renderer; the counties of
 * Texas leave the renderer to the library and stay SVG, being under the
 * 1,000-point auto threshold.
 *
 * Neither figure uses all 3,108 counties of the lower 48 states: a demo's Spec
 * code tab writes every data row out, highlighted, at about 400 bytes a row,
 * which would take the page past its 500 KB budget. Both are `static: false`
 * for the same budget, so the circles are drawn in the browser.
 */
import { geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import usCounties from "us-atlas/counties-10m.json";
import type { LonLat } from "../maps/centers";
import { defineDemo } from "../types";

/**
 * The geography credit in the form maps/sources.ts writes it, which does not
 * export it; these charts have no dataset of their own to put before it.
 */
const SOURCE = { label: "US Census Bureau via us-atlas" };

/** State FIPS codes outside the lower 48 and DC: Alaska, Hawaii and the territories. */
const OUTSIDE_LOWER_48 = new Set(["02", "15", "60", "66", "69", "72", "78"]);
const TEXAS_FIPS = "48";
const MERIDIAN = -100;

type CountyCenter = LonLat & { state: string };

// The same two-decimal rounding as maps/centers.ts, which keeps its own private.
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The center of every county in the lower 48 states and DC, with the two-digit
 * FIPS code of its state.
 *
 * @throws {Error} When the topology has no `counties` object.
 */
function countyCenters(topology: Topology): CountyCenter[] {
  const counties = topology.objects.counties;
  if (!counties) throw new Error('us-atlas counties-10m.json has no "counties" object.');
  const collection = feature(topology, counties);
  const features = "features" in collection ? collection.features : [collection];
  return features
    .map((county) => ({ county, state: String(county.id).slice(0, 2) }))
    .filter(({ state }) => !OUTSIDE_LOWER_48.has(state))
    .map(({ county, state }) => {
      const [lon, lat] = geoCentroid(county);
      return { state, lon: round(lon), lat: round(lat) };
    });
}

/** Rows for the chart: longitude and latitude only, to keep the code tab small. */
const lonLat = (centers: CountyCenter[]) => centers.map(({ lon, lat }) => ({ lon, lat }));

const centers = countyCenters(usCounties as unknown as Topology);
const west = centers.filter((center) => center.lon < MERIDIAN);
const texas = centers.filter((center) => center.state === TEXAS_FIPS);

/** A longitude and latitude scatter with both scales fitted to the points. */
const lonLatEncoding = {
  x: {
    field: "lon",
    type: "quantitative" as const,
    scale: { zero: false },
    axis: { title: "Longitude (°)", format: ".0f" },
  },
  y: {
    field: "lat",
    type: "quantitative" as const,
    scale: { zero: false },
    axis: { title: "Latitude (°)", format: ".0f", grid: true },
  },
};

export const canvasWest = defineDemo({
  id: "output/canvas-west",
  title: "Counties west of the 100th meridian",
  source: SOURCE,
  height: 480,
  static: false,
  mount: { renderer: "canvas" },
  spec: {
    mark: { type: "point", size: 2, opacity: 0.7, trendline: false },
    data: lonLat(west),
    encoding: lonLatEncoding,
    chrome: {
      title: `${west.length} counties in the lower 48 states lie west of the 100th meridian`,
      subtitle: "Geographic center of each county west of 100°W, by longitude and latitude",
    },
  },
});

export const autoTexas = defineDemo({
  id: "output/canvas-auto-texas",
  title: "Counties of Texas",
  source: SOURCE,
  height: 460,
  // Static SVGs of these 254 circles took the page to 607,893 bytes, past its 500 KB budget.
  static: false,
  spec: {
    mark: { type: "point", size: 3, opacity: 0.8, trendline: false },
    data: lonLat(texas),
    encoding: lonLatEncoding,
    chrome: {
      title: `Texas is divided into ${texas.length} counties`,
      subtitle: "Geographic center of each county, by longitude and latitude",
    },
  },
});
