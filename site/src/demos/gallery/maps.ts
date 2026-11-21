/**
 * The gallery's maps of the state unemployment rates (`us-state-unemployment`):
 * a choropleth in two bands, above 5% and at or below it, on the US atlas, and
 * a tile map with one equal tile per state and DC. Ported from the Ladle maps,
 * and sankey and tile map galleries, on this tier-1 dataset.
 */
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { usStates } from "../maps/geography";
import { sourceWithGeography } from "../maps/sources";
import { rowsByFips } from "../maps/state-fips";
import { sourceOf } from "../source";
import { WARM } from "../the-spec/shared";
import { defineDemo } from "../types";
import { countWord, statesWhere, UNEMPLOYMENT_MEASURE } from "./shared";

const ABOVE = 5;
const LOW = 3;
/** The four states the choropleth's title names, all in the Census Bureau's West region. */
export const WEST_ABOVE = ["CA", "NV", "OR", "WA"] as const;

const BAND = { above: `Above ${ABOVE}%`, below: `${ABOVE}% or less` } as const;
/**
 * A pale gray for the states at or under 5%, so the seven above carry the map.
 * Mid-light, so the state borders still read on the dark page.
 */
const PALE = "#cdd3d9";

export const unemploymentChoropleth = defineDemo({
  id: "gallery/unemployment-choropleth",
  title: "States with unemployment above 5%",
  source: sourceWithGeography(usStateUnemployment, "us"),
  caption: "The West is the Census Bureau's region of 13 states from the Rockies to the Pacific.",
  height: 460,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: rowsByFips(usStateUnemployment.data, "rate").map((row) => ({
      ...row,
      band: Number(row.rate) > ABOVE ? BAND.above : BAND.below,
    })),
    encoding: {
      key: { field: "id", type: "nominal" },
      color: {
        field: "band",
        type: "nominal",
        scale: { domain: [BAND.above, BAND.below], range: [WARM, PALE] },
        title: "Unemployment rate",
      },
    },
    chrome: {
      title:
        `${countWord(WEST_ABOVE.length)} of the ${countWord(statesWhere((rate) => rate > ABOVE))} states with unemployment above ${ABOVE}% are in the West`.replace(
          /^\w/,
          (first) => first.toUpperCase(),
        ),
      subtitle: UNEMPLOYMENT_MEASURE,
    },
  },
});

export const unemploymentTiles = defineDemo({
  id: "gallery/unemployment-tiles",
  title: "State unemployment rates on a tile grid",
  source: sourceOf(usStateUnemployment),
  height: 520,
  spec: {
    type: "tilemap",
    data: { ...usStateUnemployment.data },
    palette: "blue",
    valueFormat: ".1f",
    chrome: {
      title: `Unemployment was below ${LOW}% in ${countWord(statesWhere((rate) => rate < LOW))} states`,
      subtitle: `Each tile is one state or DC. ${UNEMPLOYMENT_MEASURE}`,
    },
  },
});
