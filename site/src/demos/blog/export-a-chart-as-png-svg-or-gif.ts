/**
 * The figures in the blog post "Export a chart as PNG, SVG or GIF": the ten
 * biggest turnout gains from 2016 to 2020, with download buttons wired to
 * `chart.export`, then the ten biggest drops in the general fertility rate
 * from 2005 to 2024. Rows are computed from the dataset modules and titles are
 * computed from the rows, so neither can drift from the data. The post's
 * `json demo` fence repeats `fertilityDrops.spec` verbatim, and a test keeps
 * the two in sync.
 */
import { cdcFertilityByState } from "@datasets/cdc-fertility-by-state";
import { uflVepTurnout } from "@datasets/ufl-vep-turnout";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";

const TOP = 10;

const turnoutSource = sourceOf(uflVepTurnout);
const fertilitySource = sourceOf(cdcFertilityByState);

const turnoutRows = uflVepTurnout.data;
const gains = turnoutRows
  .map((row) => ({
    state: row.state,
    gain: Number((row.turnout_2020 - row.turnout_2016).toFixed(1)),
  }))
  .sort((a, b) => b.gain - a.gain);
const [biggest] = gains;
if (!biggest) throw new Error("The turnout rows are empty");
const roseEverywhere = turnoutRows.every((row) => row.turnout_2020 > row.turnout_2016);
if (!roseEverywhere) throw new Error("Turnout fell in some state between 2016 and 2020");

export const turnoutGains = defineDemo({
  id: "blog/turnout-gains",
  title: "Largest turnout gains, 2016 to 2020, with export buttons",
  source: turnoutSource,
  height: 420,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: gains.slice(0, TOP),
    encoding: {
      x: {
        field: "gain",
        type: "quantitative",
        axis: { title: "Change, points", format: ".0f" },
      },
      y: { field: "state", type: "nominal", sort: "x" },
    },
    labels: { format: "+.1f" },
    chrome: {
      title: `Turnout rose in all ${turnoutRows.length} jurisdictions from 2016 to 2020, most in ${biggest.state}`,
      subtitle: `The ${TOP} largest gains in turnout of the voting-eligible population, percentage points`,
      // An exported image leaves the page's caption behind, so the chart carries its own source.
      source: uflVepTurnout.source,
    },
  },
  controls: { exports: ["svg", "png", "csv"] },
});

const namesByCode = new Map(turnoutRows.map((row) => [row.state_abbr, row.state]));
const drops = cdcFertilityByState.data
  .map((row) => ({
    state: namesByCode.get(row.state) ?? row.state,
    rate_2005: row.fertility_2005,
    rate_2024: row.fertility_2024,
    drop: Number((row.fertility_2005 - row.fertility_2024).toFixed(1)),
  }))
  .sort((a, b) => b.drop - a.drop);
const [steepest] = drops;
if (!steepest) throw new Error("The fertility rows are empty");
const fellEverywhere = cdcFertilityByState.data.every(
  (row) => row.fertility_2024 < row.fertility_2005,
);
if (!fellEverywhere) throw new Error("The fertility rate rose in some state");

export const fertilityDrops = defineDemo({
  id: "blog/fertility-drops",
  title: "Largest drops in the general fertility rate, 2005 to 2024",
  source: fertilitySource,
  height: 420,
  spec: {
    mark: { type: "range", style: "arrow" },
    // A light/dark pair: the site teal on white, a lighter teal on the dark page.
    theme: { colors: { categorical: [{ light: ACCENT, dark: "#22a3c4" }] } },
    data: drops.slice(0, TOP),
    encoding: {
      y: { field: "state", type: "nominal", sort: { field: "drop", order: "ascending" } },
      x: {
        field: "rate_2005",
        type: "quantitative",
        title: "2005",
        axis: { title: "Births per 1,000 women" },
      },
      x2: { field: "rate_2024", type: "quantitative", title: "2024" },
    },
    chrome: {
      title: `The fertility rate fell in all ${cdcFertilityByState.data.length} jurisdictions, from ${steepest.rate_2005.toFixed(1)} to ${steepest.rate_2024.toFixed(1)} in ${steepest.state}`,
      subtitle: `The ${TOP} largest drops in the general fertility rate (births per 1,000 women ages 15-44), 2005 to 2024. Each arrow runs from the 2005 rate to the 2024 rate.`,
      source: cdcFertilityByState.source,
    },
  },
});
