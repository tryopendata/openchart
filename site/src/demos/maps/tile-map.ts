/**
 * Demos for the tile map page (docs/maps/tile-map). Specs follow the tile map
 * section of the Ladle sankey and tile map gallery: a record of state code to
 * value, categorical colors, and tabular rows that cover only some states.
 */
import { stateEconomies } from "@datasets/state-economies";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { vaccineExemptions } from "@datasets/vaccine-exemptions";
import { defineDemo } from "../types";
import { sourceOf } from "./sources";

export const basicTileMap = defineDemo({
  id: "maps/tile-basic",
  title: "Unemployment rate by state, one tile each",
  source: sourceOf(usStateUnemployment),
  height: 520,
  spec: {
    type: "tilemap",
    data: { ...usStateUnemployment.data },
    palette: "blue",
    valueFormat: ".1f",
    chrome: {
      title: "Unemployment is highest in DC and lowest in South Dakota",
      subtitle: "State unemployment rate, seasonally adjusted (%)",
    },
  },
});

/** The dataset's category keys, as a reader should see them in the legend. */
const EXEMPTION_LABELS: Record<string, string> = {
  medical_only: "Medical only",
  religious: "Religious",
  philosophical: "Philosophical",
};

const exemptionsByState = Object.fromEntries(
  Object.entries(vaccineExemptions.data).map(([state, kind]) => [
    state,
    EXEMPTION_LABELS[kind] ?? kind,
  ]),
);

export const categoricalTileMap = defineDemo({
  id: "maps/tile-categorical",
  title: "Broadest vaccine exemption each state allows",
  source: sourceOf(vaccineExemptions),
  height: 520,
  spec: {
    type: "tilemap",
    data: exemptionsByState,
    colors: { "Medical only": "#ee4a73", Religious: "#e07d00", Philosophical: "#06b6d4" },
    chrome: {
      title: "Broadest vaccine exemption each state allows",
      subtitle: "Medical only, religious, or philosophical",
    },
  },
});

export const partialTileMap = defineDemo({
  id: "maps/tile-rows",
  title: "GDP of the ten largest state economies",
  source: sourceOf(stateEconomies),
  height: 520,
  spec: {
    type: "tilemap",
    data: [...stateEconomies.data],
    encoding: {
      state: { field: "label", type: "nominal" },
      value: { field: "gdp", type: "quantitative", format: ".1f" },
    },
    palette: "green",
    chrome: {
      title: "Ten states, the rest left blank",
      subtitle: "GDP of the ten largest state economies, 2023 ($ trillions)",
    },
  },
});
