/**
 * Demos for the canvas page (docs/output/canvas): county centers computed from
 * us-atlas with d3-geo, drawn as longitude and latitude scatters. Every county
 * of the lower 48 states and DC leaves the renderer to the library, which
 * picks the canvas because the chart is over the 1,000-point auto threshold;
 * the counties west of the 100th meridian, under it, ask for the canvas with
 * `mount.renderer`.
 *
 * Both are `static: false`: a static SVG would draw every circle as an element,
 * twice (light and dark), past the page's 500 KB budget. The Spec code tab
 * shows only the first rows of each, and Copy fills the rest in.
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

const count = (n: number) => n.toLocaleString("en-US");

export const canvasAllCounties = defineDemo({
  id: "output/canvas-all-counties",
  title: "Every county in the lower 48 states and DC",
  source: SOURCE,
  height: 480,
  static: false,
  spec: {
    mark: { type: "point", size: 1.5, opacity: 0.6, trendline: false },
    data: lonLat(centers),
    encoding: lonLatEncoding,
    chrome: {
      title: `The lower 48 states and DC have ${count(centers.length)} counties and county equivalents`,
      subtitle: "Geographic center of each county or county equivalent, by longitude and latitude",
    },
  },
});

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
      title: `${count(west.length)} counties in the lower 48 states lie west of the 100th meridian`,
      subtitle: "Geographic center of each county west of 100°W, by longitude and latitude",
    },
  },
});
