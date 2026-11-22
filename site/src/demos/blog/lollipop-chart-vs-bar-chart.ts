/**
 * The figures in the blog post "Lollipop chart vs bar chart": food CO2 per person
 * in the 20 highest of 130 countries as bars and then as lollipops, median weekly
 * earnings by education as bars, the same earnings as lollipops on an axis that
 * starts at $600, and as a stemless dot plot on that axis. Titles state findings
 * computed from the dataset rows so they cannot drift from the data. The post's
 * `json demo` fences repeat `co2Lollipop.spec`, `educationLollipopTrimmed.spec` and
 * `educationDotPlot.spec` verbatim, and a test holds them together.
 */
import { blsEducationPays } from "@datasets/bls-education-pays";
import { tidyTuesdayFoodCo2ByCountry } from "@datasets/tidytuesday-food-co2";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The row at the given index of a dataset the demo cannot be built without. */
function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new Error(`The ${what} dataset has no such row.`);
  return row;
}

// A light and a dark value, so value labels printed in the bar color keep 4.5:1 on
// the page in both site themes. A plain hex renders verbatim in dark.
const TEAL = { light: "#0e7490", dark: "#22a3c4" };
const teal = { colors: { categorical: [TEAL] } };

// The file's own names for two places, shortened for the axis. The values are untouched.
const COUNTRY_LABELS: Record<string, string> = {
  USA: "United States",
  "Hong Kong SAR. China": "Hong Kong",
};
const EDUCATION_LABELS: Record<string, string> = {
  "Less than a high school diploma": "Less than high school",
  "Some college, no degree": "Some college",
};

const countryRows = tidyTuesdayFoodCo2ByCountry.data.map((row) => ({
  country: COUNTRY_LABELS[row.country] ?? row.country,
  kgCo2: row.kg_co2_per_person,
}));
const topCountry = must(tidyTuesdayFoodCo2ByCountry.data[0], "food CO2 by country");
const lastCountry = must(
  tidyTuesdayFoodCo2ByCountry.data[tidyTuesdayFoodCo2ByCountry.data.length - 1],
  "food CO2 by country",
);
const kg = (value: number) => Math.round(value).toLocaleString("en-US");
/** The beef part of the top country's food CO2, as a whole percent. */
export const topBeefPct = Math.round((topCountry.kg_co2_beef / topCountry.kg_co2_per_person) * 100);

const foodTitle = `${topCountry.country}'s diet produces ${kg(topCountry.kg_co2_per_person)} kg of CO2 per person a year, the most of 130 countries`;
const foodSubtitle = `Kilograms of CO2 per person per year from 11 food types, the ${countryRows.length} highest of 130 countries (no year stated)`;
const foodX = {
  field: "kgCo2",
  type: "quantitative",
  axis: { title: "kg CO2 per person per year", format: ",.0f" },
} as const;
const foodY = { field: "country", type: "nominal", sort: "x" } as const;
export const foodRange = {
  low: kg(lastCountry.kg_co2_per_person),
  high: kg(topCountry.kg_co2_per_person),
};

export const co2Bars = defineDemo({
  id: "blog/co2-bars",
  title: "Food CO2 per person in 20 countries, as bars",
  source: sourceOf(tidyTuesdayFoodCo2ByCountry),
  height: 560,
  spec: {
    mark: "bar",
    data: countryRows,
    encoding: { x: foodX, y: foodY },
    labels: { density: "none" },
    theme: teal,
    chrome: { title: foodTitle, subtitle: foodSubtitle },
  },
});

export const co2Lollipop = defineDemo({
  id: "blog/co2-lollipop",
  title: "Food CO2 per person in 20 countries, as lollipops",
  source: sourceOf(tidyTuesdayFoodCo2ByCountry),
  height: 560,
  spec: {
    mark: "lollipop",
    data: countryRows,
    encoding: { x: foodX, y: foodY },
    theme: teal,
    chrome: { title: foodTitle, subtitle: foodSubtitle },
  },
});

const educationRows = blsEducationPays.data.map((row) => ({
  education: EDUCATION_LABELS[row.education_level] ?? row.education_level,
  weeklyEarnings: row.median_weekly_earnings,
}));
const topEarnings = Math.max(...educationRows.map((row) => row.weeklyEarnings));
const bottomEarnings = Math.min(...educationRows.map((row) => row.weeklyEarnings));
const money = (value: number) => `$${value.toLocaleString("en-US")}`;
const educationSubtitle = "Median usual weekly earnings by educational attainment, 2024 ($)";

export const educationBars = defineDemo({
  id: "blog/education-bars",
  title: "Median weekly earnings by education, as bars",
  source: sourceOf(blsEducationPays),
  height: 420,
  spec: {
    mark: "bar",
    data: educationRows,
    encoding: {
      x: {
        field: "weeklyEarnings",
        type: "quantitative",
        axis: { title: "Median weekly earnings ($)", format: "$,.0f" },
      },
      y: { field: "education", type: "nominal", sort: "x" },
    },
    labels: { density: "all", format: "$,.0f" },
    theme: teal,
    chrome: {
      title: `Median weekly earnings range from ${money(bottomEarnings)} to ${money(topEarnings)} by education`,
      subtitle: educationSubtitle,
    },
  },
});

const TRIMMED_FROM = 600;
// Ticks start at the trimmed edge so the reader can see the axis does not begin at zero.
const trimmedX = {
  field: "weeklyEarnings",
  type: "quantitative" as const,
  scale: { zero: false, domain: [TRIMMED_FROM, 2400] },
  axis: {
    title: "Median weekly earnings ($)",
    format: "$,.0f",
    values: [TRIMMED_FROM, 1200, 1800],
  },
};
export const realRatio = Number((topEarnings / bottomEarnings).toFixed(1));
export const stemRatio = Number(
  ((topEarnings - TRIMMED_FROM) / (bottomEarnings - TRIMMED_FROM)).toFixed(1),
);

export const educationLollipopTrimmed = defineDemo({
  id: "blog/education-lollipop-trimmed",
  title: "Median weekly earnings by education, lollipops from $600",
  source: sourceOf(blsEducationPays),
  height: 420,
  spec: {
    mark: "lollipop",
    data: educationRows,
    encoding: {
      x: trimmedX,
      y: { field: "education", type: "nominal", sort: "x" },
    },
    theme: teal,
    chrome: {
      title: `An axis from ${money(TRIMMED_FROM)} makes a ${realRatio}-times gap look like ${stemRatio} times`,
      subtitle: educationSubtitle,
    },
  },
});

// The stemless version: dots alone encode position, so the same trimmed axis is fair.
// `trendline: false` matters, since a point mark otherwise fits a line through the dots.
export const educationDotPlot = defineDemo({
  id: "blog/education-dot-plot",
  title: "Median weekly earnings by education, dots on an axis from $600",
  source: sourceOf(blsEducationPays),
  height: 420,
  spec: {
    mark: { type: "point", trendline: false },
    data: educationRows,
    encoding: {
      x: trimmedX,
      // A point mark thins category labels like numeric ticks; listing them keeps all eight.
      y: {
        field: "education",
        type: "nominal",
        sort: "x",
        axis: { values: educationRows.map((row) => row.education) },
      },
    },
    theme: teal,
    chrome: {
      title: `Median weekly earnings range from ${money(bottomEarnings)} to ${money(topEarnings)} by education`,
      subtitle: educationSubtitle,
    },
  },
});
