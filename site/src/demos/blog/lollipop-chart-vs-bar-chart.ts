/**
 * The figures in the blog post "Lollipop chart vs bar chart": food CO2 per
 * kilogram as bars and then as lollipops, median weekly earnings by education as
 * bars, and the same earnings as lollipops on an axis that does not start at
 * zero. Titles state findings computed from the dataset rows so they cannot
 * drift from the data. The post's `json demo` fences repeat `co2Lollipop.spec`
 * and `educationLollipopTrimmed.spec` verbatim, and a test holds them together.
 */
import { blsEducationPays } from "@datasets/bls-education-pays";
import { tidyTuesdayFoodCo2 } from "@datasets/tidytuesday-food-co2";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The row at the given index of a dataset the demo cannot be built without. */
function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new Error(`The ${what} dataset has no such row.`);
  return row;
}

const BLUE = "#0e7490";

// Short axis labels for categories whose source names are long. The values are untouched.
const FOOD_LABELS: Record<string, string> = {
  "Nuts inc. Peanut Butter": "Nuts",
  "Wheat and Wheat Products": "Wheat",
  "Milk - inc. cheese": "Milk and cheese",
  "Lamb & Goat": "Lamb and goat",
};
const EDUCATION_LABELS: Record<string, string> = {
  "Less than a high school diploma": "Less than high school",
  "Some college, no degree": "Some college",
};

const foodRows = tidyTuesdayFoodCo2.data
  .map((row) => ({
    food: FOOD_LABELS[row.food_category] ?? row.food_category,
    kgCo2PerKg: row.kg_co2_per_kg_food,
  }))
  .sort((a, b) => b.kgCo2PerKg - a.kgCo2PerKg);

const [firstFood, secondFood, ...rest] = foodRows;
const highest = must(firstFood, "food CO2");
const second = must(secondFood, "food CO2");
const restMax = Math.max(...rest.map((row) => row.kgCo2PerKg));
// The title names lamb, goat and beef as the two highest rows, so fail if the rows stop agreeing.
if (highest.food !== "Lamb and goat" || second.food !== "Beef") {
  throw new Error("The food CO2 title assumes lamb and goat rank first and beef second.");
}
const foodTitle = `Lamb, goat and beef emit ${Math.round(second.kgCo2PerKg)} to ${Math.round(highest.kgCo2PerKg)} kg of CO2 per kg of food, and no other food tops ${restMax.toFixed(1)}`;
const foodSubtitle =
  "Kilograms of CO2 per kilogram of food, 130 countries combined (no year stated)";

export const co2Bars = defineDemo({
  id: "blog/co2-bars",
  title: "CO2 per kilogram of food, as bars",
  source: sourceOf(tidyTuesdayFoodCo2),
  height: 460,
  spec: {
    mark: { type: "bar", fill: BLUE },
    data: foodRows,
    encoding: {
      x: { field: "kgCo2PerKg", type: "quantitative", axis: { title: "kg CO2 per kg of food" } },
      y: { field: "food", type: "nominal", sort: "x" },
    },
    labels: { density: "none" },
    chrome: { title: foodTitle, subtitle: foodSubtitle },
  },
});

export const co2Lollipop = defineDemo({
  id: "blog/co2-lollipop",
  title: "CO2 per kilogram of food, as lollipops",
  source: sourceOf(tidyTuesdayFoodCo2),
  height: 460,
  spec: {
    mark: "lollipop",
    data: foodRows,
    encoding: {
      x: { field: "kgCo2PerKg", type: "quantitative", axis: { title: "kg CO2 per kg of food" } },
      y: { field: "food", type: "nominal", sort: "x" },
    },
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
    mark: { type: "bar", fill: BLUE },
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
    chrome: {
      title: `Median weekly earnings run from ${money(bottomEarnings)} to ${money(topEarnings)} across eight education levels`,
      subtitle: educationSubtitle,
    },
  },
});

const TRIMMED_FROM = 600;
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
      x: {
        field: "weeklyEarnings",
        type: "quantitative",
        scale: { zero: false, domain: [TRIMMED_FROM, 2400] },
        axis: { title: "Median weekly earnings ($)", format: "$,.0f" },
      },
      y: { field: "education", type: "nominal", sort: "x" },
    },
    chrome: {
      title: `Starting the axis at ${money(TRIMMED_FROM)} stretches a ${realRatio}-times gap into ${stemRatio} times`,
      subtitle: educationSubtitle,
    },
  },
});
