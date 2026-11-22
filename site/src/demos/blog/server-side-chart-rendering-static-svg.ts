/**
 * The figures in the blog post "Server-side chart rendering with static SVG":
 * the five states where house prices rose most and the five where they rose
 * least since 2019Q4, then the states with the largest net domestic migration
 * gains and losses in 2022-23. Rows are computed from the dataset modules and
 * titles are computed from the rows, so neither can drift from the data. The
 * post's `json demo` fence repeats `migrationExtremes.spec` verbatim, and a
 * test keeps the two in sync.
 */
import { fhfaStateHpi } from "@datasets/fhfa-state-hpi";
import { irsStateMigration } from "@datasets/irs-state-migration";
import { uflVepTurnout } from "@datasets/ufl-vep-turnout";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";

/**
 * Gain and loss colors as light/dark pairs. A value label outside its bar takes
 * the bar's color, so each value clears 4.5:1 as text on its own page.
 */
const TEAL = { light: ACCENT, dark: "#22a3c4" };
const ORANGE = { light: "#b54d00", dark: "#f07a2b" };

const names = new Map(uflVepTurnout.data.map((row) => [row.state_abbr, row.state]));
const nameOf = (code: string) => names.get(code) ?? code;
/** The name a title uses: "DC" reads better in a sentence than "District of Columbia". */
const titleName = (name: string) => (name === "District of Columbia" ? "DC" : name);

const EDGE = 5;

const byGrowth = fhfaStateHpi.data
  .map((row) => ({ state: nameOf(row.state), change: row.pct_change_2019q4_2026q2 }))
  .sort((a, b) => b.change - a.change);
const [highest] = byGrowth;
const lowest = byGrowth.at(-1);
if (!highest || !lowest) throw new Error("The FHFA rows are empty");

export const housePriceRange = defineDemo({
  id: "blog/house-price-range",
  title: "House price growth by state, 2019Q4 to 2026Q2: the five highest and five lowest",
  source: sourceOf(fhfaStateHpi),
  height: 420,
  spec: {
    mark: { type: "bar" },
    theme: { colors: { categorical: [TEAL] } },
    data: [...byGrowth.slice(0, EDGE), ...byGrowth.slice(-EDGE)],
    encoding: {
      x: {
        field: "change",
        type: "quantitative",
        axis: { title: "Change in house price index (%)", format: ".0f" },
      },
      y: { field: "state", type: "nominal", sort: "x" },
    },
    labels: { format: ".1f", suffix: "%" },
    chrome: {
      title: `House prices rose ${highest.change.toFixed(1)}% in ${highest.state} from 2019 to 2026 and ${lowest.change.toFixed(1)}% in ${titleName(lowest.state)}`,
      subtitle: `Change in the all-transactions house price index, 2019 Q4 to 2026 Q2: the ${EDGE} jurisdictions with the largest and smallest increases`,
    },
  },
});

const migration = irsStateMigration.data
  .map((row) => ({
    state: nameOf(row.state),
    net: row.net_2022_23,
    direction: row.net_2022_23 < 0 ? "Net loss" : "Net gain",
  }))
  .sort((a, b) => b.net - a.net);
const topGain = migration[0];
const topLoss = migration.at(-1);
if (!topGain || !topLoss) throw new Error("The IRS rows are empty");

export const migrationExtremes = defineDemo({
  id: "blog/migration-extremes",
  title: "Net domestic migration by state, 2022-23: the five largest gains and losses",
  source: sourceOf(irsStateMigration),
  height: 420,
  spec: {
    mark: { type: "bar" },
    data: [...migration.slice(0, EDGE), ...migration.slice(-EDGE)],
    encoding: {
      x: {
        field: "net",
        type: "quantitative",
        axis: { title: "People (tax-filer exemptions)", format: ",.0f" },
      },
      y: { field: "state", type: "nominal", sort: "-x" },
      color: {
        field: "direction",
        type: "nominal",
        scale: { domain: ["Net gain", "Net loss"] },
      },
    },
    theme: { colors: { categorical: [TEAL, ORANGE] } },
    legend: { show: false },
    labels: { format: ",.0f" },
    chrome: {
      title: `${topLoss.state} lost a net ${Math.abs(topLoss.net).toLocaleString("en-US")} people to other states in 2022-23, while ${topGain.state} gained ${topGain.net.toLocaleString("en-US")}`,
      subtitle: `Net domestic migration in 2022-23, IRS tax-filer exemptions: the ${EDGE} largest gains and losses`,
    },
  },
});
