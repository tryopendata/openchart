/**
 * The figures in the blog post "Declarative chart spec vs D3": developers
 * pushing TypeScript and Java code by quarter, the chart the post builds twice
 * (as a JSON spec and as D3), then the spread of pay inside each occupation
 * group. Rows are computed from the dataset modules and titles are computed
 * from the rows, so neither can drift from the data. The post's `json demo`
 * fence repeats `typescriptPassesJava.spec` verbatim, and a test keeps the two
 * in sync.
 */
import { blsOccupationWages } from "@datasets/bls-occupation-wages";
import { githubLanguageDevelopers } from "@datasets/github-language-developers";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";

/** The highlight teal as a light/dark pair, so its end labels stay readable on the dark page. */
const TEAL = { light: ACCENT, dark: "#22a3c4" };
/** The context line's grey: the site grey on white, a lighter one on the dark page. */
const GREY_PAIR = { light: "#66707a", dark: "#9aa0a6" };
/** Context bars: light enough to recede behind the two compared groups on either page. */
const CONTEXT = { light: "#d4d4d8", dark: "#3f3f46" };

const quarters = githubLanguageDevelopers.data;

/** The first day of a quarter, so the x axis can be a time axis: "2023-Q3" becomes "2023-07-01". */
const quarterStart = (quarter: string) => {
  const [year, number] = quarter.split("-Q");
  return `${year}-${String((Number(number) - 1) * 3 + 1).padStart(2, "0")}-01`;
};

const longRows = quarters.flatMap((row) => [
  { date: quarterStart(row.quarter), language: "TypeScript", pushers: row.typescript },
  { date: quarterStart(row.quarter), language: "Java", pushers: row.java },
]);

const first = quarters[0];
const last = quarters.at(-1);
const passed = quarters.find((row) => row.typescript > row.java);
if (!first || !last || !passed) throw new Error("The GitHub language rows do not cross");
const growth = (last.typescript / first.typescript).toFixed(1);
const quarterLabel = (quarter: string) => quarter.replace("-Q", " Q");

export const typescriptPassesJava = defineDemo({
  id: "blog/typescript-passes-java",
  title: "Developers pushing TypeScript and Java code, by quarter",
  source: sourceOf(githubLanguageDevelopers),
  height: 420,
  spec: {
    mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
    data: longRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "pushers",
        type: "quantitative",
        scale: { zero: true },
        axis: { format: "~s", grid: true },
      },
      color: {
        field: "language",
        type: "nominal",
        scale: { domain: ["TypeScript", "Java"] },
      },
    },
    theme: { colors: { categorical: [TEAL, GREY_PAIR] } },
    legend: { show: false },
    endpointLabels: { format: ".3~s" },
    annotations: [
      {
        type: "text",
        x: quarterStart(passed.quarter),
        y: passed.typescript,
        text: `${quarterLabel(passed.quarter)}: TypeScript passes Java`,
        anchor: "top",
        offset: { dx: -110, dy: -56 },
        connector: true,
      },
    ],
    chromeLayout: "subtract",
    chrome: {
      title: `TypeScript overtook Java in ${quarterLabel(passed.quarter)} and has grown ${growth}x since ${quarterLabel(first.quarter)}`,
      subtitle: "Developers pushing code to GitHub each quarter, summed across economies",
    },
  },
});

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Shorter axis labels for the group names that would not fit beside a phone-width plot. */
const SHORT_NAMES: Record<string, string> = {
  "Arts, Design, Entertainment, Sports, and Media": "Arts and media",
  "Life, Physical, and Social Science": "Science",
  "Building and Grounds Cleaning and Maintenance": "Building cleaning",
  "Installation, Maintenance, and Repair": "Installation and repair",
  "Educational Instruction and Library": "Education and library",
  "Healthcare Practitioners and Technical": "Healthcare practitioners",
  "Transportation and Material Moving": "Transportation",
  "Office and Administrative Support": "Office and admin",
  "Food Preparation and Serving Related": "Food service",
  "Farming, Fishing, and Forestry": "Farming and fishing",
  "Business and Financial Operations": "Business and finance",
  "Computer and Mathematical": "Computer and math",
  "Community and Social Service": "Community service",
  "Architecture and Engineering": "Engineering",
  "Construction and Extraction": "Construction",
  "Personal Care and Service": "Personal care",
  "Sales and Related": "Sales",
};
/** The axis label for a group, in sentence case like the shortened names. */
const groupName = (title: string) => {
  const name = title.replace(/ Occupations$/, "");
  const short = SHORT_NAMES[name] ?? name;
  return short.charAt(0) + short.slice(1).toLowerCase();
};

// The rows arrive ordered by median pay, highest first. A horizontal bar chart draws the first
// row at the bottom, so the order is reversed to put the highest median on top.
const groupStartingWith = (title: string) => {
  const match = blsOccupationWages.data.find((row) => row.occ_title.startsWith(title));
  if (!match) throw new Error(`No occupation group starts with "${title}"`);
  return match;
};
const manager = groupStartingWith("Management");
const food = groupStartingWith("Food Preparation");
if (!(food.a_pct90 < manager.a_pct10)) {
  throw new Error("The food service 90th percentile is not below the manager 10th percentile");
}
/** The two groups the title compares are colored; the rest are context. */
const compared = new Set([manager.occ_title, food.occ_title]);
const wages = [...blsOccupationWages.data].reverse().map((row) => ({
  group: groupName(row.occ_title),
  p10: row.a_pct10,
  p90: row.a_pct90,
  role: compared.has(row.occ_title) ? "Compared" : "Other",
}));
const PAY_TICKS = [0, 50_000, 100_000, 150_000, 200_000, 250_000];

/** Phones span compact (under 400px) and medium (400 to 700px), so both take the short title. */
const phoneOverride = {
  encoding: { x: { axis: { values: [0, 100_000, 200_000] } } },
  chrome: {
    title: `Food service 90th percentile pay, ${money(food.a_pct90)}, is below a manager's 10th, ${money(manager.a_pct10)}`,
  },
};

export const occupationPayRanges = defineDemo({
  id: "blog/occupation-pay-ranges",
  title: "Annual pay from the 10th to the 90th percentile, by occupation group",
  source: sourceOf(blsOccupationWages),
  height: 640,
  spec: {
    mark: { type: "range", style: "bar" },
    data: wages,
    encoding: {
      y: { field: "group", type: "nominal", sort: null },
      x: {
        field: "p10",
        type: "quantitative",
        title: "10th percentile",
        scale: { domain: [0, 300_000] },
        axis: { title: "Annual pay", format: "$~s", values: PAY_TICKS, grid: true },
      },
      x2: { field: "p90", type: "quantitative", title: "90th percentile" },
      color: { field: "role", type: "nominal", scale: { domain: ["Compared", "Other"] } },
    },
    // The rule's color is also its label's; the default grey is 3.5:1 on white.
    theme: {
      colors: {
        categorical: [TEAL, CONTEXT],
        annotationRule: { light: "#6b6b66", dark: "#a3a39c" },
      },
    },
    legend: { show: false },
    annotations: [
      {
        type: "refline",
        x: manager.a_pct10,
        label: money(manager.a_pct10),
        style: "dashed",
        labelPlacement: "outside",
      },
    ],
    overrides: {
      compact: phoneOverride,
      medium: phoneOverride,
    },
    chrome: {
      title: `A food service worker at the 90th percentile earns ${money(food.a_pct90)}, less than a manager at the 10th, ${money(manager.a_pct10)}`,
      subtitle:
        "Annual pay from the 10th to the 90th percentile in each of the 22 major occupation groups, US, 2025",
    },
  },
});
