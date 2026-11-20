/**
 * Demos for the column, grouped and stacked, lollipop, bar list and range pages
 * (docs/comparison). Specs follow the Ladle gallery files for bar and column,
 * scatter and distribution, and dashboards; each takes its data and citation
 * from one dataset module in examples/src/data.
 */
import { commuteTimes } from "@datasets/commute-times";
import { departmentBudgets } from "@datasets/department-budgets";
import { electricityShareChange } from "@datasets/electricity-share-change";
import { householdSpending } from "@datasets/household-spending";
import { lifeExpectancyChange } from "@datasets/life-expectancy-change";
import { lifeExpectancyGender } from "@datasets/life-expectancy-gender";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { programmingLanguages } from "@datasets/programming-languages";
import { renewableCapacityAdditions } from "@datasets/renewable-capacity";
import { statePopulationChange } from "@datasets/state-population-change";
import { temperatureAnomaly } from "@datasets/temperature-anomaly";
import { usPayrolls } from "@datasets/us-payrolls";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";
const LOSS = "#d1495b";

// Column page

export const basicColumn = defineDemo({
  id: "comparison/column-basic",
  title: "US payroll additions by month",
  source: sourceOf(usPayrolls),
  height: 420,
  spec: {
    mark: "bar",
    data: [...usPayrolls.data],
    encoding: {
      x: { field: "month", type: "nominal" },
      y: { field: "jobs", type: "quantitative", axis: { title: "Jobs added (thousands)" } },
    },
    labels: { density: "all", format: ",.0f" },
    chrome: {
      title: "The job market cooled but never cracked",
      subtitle: "Monthly US nonfarm payroll additions, 2024 (thousands of jobs)",
    },
  },
});

export const annotatedColumn = defineDemo({
  id: "comparison/column-annotated",
  title: "Payroll additions with an average line and a note",
  source: sourceOf(usPayrolls),
  height: 460,
  spec: {
    mark: "bar",
    data: [...usPayrolls.data],
    encoding: {
      x: { field: "month", type: "nominal" },
      y: { field: "jobs", type: "quantitative", axis: { title: "Jobs added (thousands)" } },
    },
    labels: { density: "none" },
    annotations: [
      {
        type: "text",
        x: "Oct",
        y: 12,
        text: "Hurricanes and strikes\nstalled October hiring",
        anchor: "top",
        offset: { dy: -170 },
        connector: true,
      },
      {
        type: "refline",
        y: 216,
        label: "avg: 216K",
        style: "dashed",
        stroke: "#64748b",
        strokeWidth: 1,
        labelPlacement: "outside",
      },
    ],
    chrome: {
      title: "October stood out in a steady year",
      subtitle: "Monthly US nonfarm payroll additions, 2024 (thousands of jobs)",
    },
  },
});

export const divergingColumn = defineDemo({
  id: "comparison/column-diverging",
  title: "Temperature anomaly by half-decade",
  source: sourceOf(temperatureAnomaly),
  height: 460,
  spec: {
    mark: "bar",
    data: [...temperatureAnomaly.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "anomaly",
        type: "quantitative",
        axis: { title: "Temperature anomaly (°C)", format: "+.1f" },
      },
      color: {
        field: "trend",
        type: "nominal",
        scale: { domain: ["Cooler", "Warmer"], range: ["#3b82c4", LOSS] },
      },
    },
    labels: { density: "none" },
    annotations: [{ type: "refline", y: 0, style: "solid", strokeWidth: 1 }],
    chrome: {
      title: "Since 1980, every half-decade has been warmer than average",
      subtitle: "Global surface temperature anomaly vs. 20th-century average, °C",
    },
  },
});

export const longLabelColumn = defineDemo({
  id: "comparison/column-long-labels",
  title: "Departmental budgets",
  source: sourceOf(departmentBudgets),
  height: 440,
  spec: {
    mark: "bar",
    data: [...departmentBudgets.data],
    encoding: {
      x: { field: "department", type: "nominal" },
      y: { field: "budget", type: "quantitative", axis: { title: "Budget ($M)" } },
    },
    chrome: {
      title: "R&D claims the biggest slice",
      subtitle: "Annual departmental budget allocations, FY 2025 ($M)",
    },
  },
});

export const signedColumn = defineDemo({
  id: "comparison/column-outside-labels",
  title: "Signed values with outside labels",
  source: { label: "Illustrative data" },
  height: 400,
  spec: {
    mark: { type: "bar", size: 28 },
    data: [
      { name: "Research", value: 128.4 },
      { name: "Operations", value: 75.2 },
      { name: "Training", value: 8.6 },
      { name: "Contingency", value: 0 },
      { name: "Adjustments", value: -24.3 },
    ],
    encoding: {
      x: { field: "name", type: "nominal", sort: null, scale: { paddingInner: 0.4 } },
      y: { field: "value", type: "quantitative", axis: { title: "Millions" } },
    },
    labels: { placement: "outside", density: "all", format: ".1f", suffix: "M" },
    legend: { show: false },
    chrome: {
      title: "Positive and negative values follow their endpoints",
      subtitle: "Budget allocations, millions",
    },
  },
});

// Grouped and stacked page

export const groupedColumns = defineDemo({
  id: "comparison/grouped-columns",
  title: "Renewable capacity added by source, grouped",
  source: sourceOf(renewableCapacityAdditions),
  height: 440,
  spec: {
    mark: "bar",
    data: [...renewableCapacityAdditions.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: {
        field: "capacity",
        type: "quantitative",
        stack: null,
        axis: { title: "Capacity added (GW)" },
      },
      color: { field: "type", type: "nominal" },
    },
    labels: { density: "all" },
    chrome: {
      title: "Solar is running away with the energy transition",
      subtitle: "Global renewable capacity additions by source, 2019-2023 (gigawatts)",
    },
  },
});

export const stackedColumns = defineDemo({
  id: "comparison/stacked-columns",
  title: "Renewable capacity added by source, stacked",
  source: sourceOf(renewableCapacityAdditions),
  height: 440,
  spec: {
    mark: "bar",
    data: [...renewableCapacityAdditions.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: {
        field: "capacity",
        type: "quantitative",
        stack: "zero",
        axis: { title: "Capacity added (GW)" },
      },
      color: { field: "type", type: "nominal" },
    },
    labels: { density: "none" },
    chrome: {
      title: "Total additions more than doubled in four years",
      subtitle: "Global renewable capacity additions by source, 2019-2023 (gigawatts)",
    },
  },
});

export const labelledStackedBars = defineDemo({
  id: "comparison/stacked-bars-labelled",
  title: "Household spending, stacked with labels",
  source: sourceOf(householdSpending),
  height: 440,
  spec: {
    mark: "bar",
    data: [...householdSpending.data],
    encoding: {
      x: {
        field: "pct",
        type: "quantitative",
        stack: "zero",
        axis: { title: "Share of spending (%)" },
      },
      y: { field: "bracket", type: "nominal" },
      color: { field: "category", type: "nominal" },
    },
    labels: { density: "all" },
    chrome: {
      title: "The poorer you are, the more housing eats your paycheck",
      subtitle: "Share of annual household expenditure by category and income bracket, 2022 (%)",
    },
  },
});

export const normalizedBars = defineDemo({
  id: "comparison/stacked-bars-normalized",
  title: "Household spending, normalized",
  source: sourceOf(householdSpending),
  height: 440,
  spec: {
    mark: "bar",
    data: [...householdSpending.data],
    encoding: {
      x: {
        field: "pct",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of spending", format: ".0%" },
      },
      y: { field: "bracket", type: "nominal" },
      color: { field: "category", type: "nominal" },
    },
    labels: { density: "none" },
    chrome: {
      title: "Every bracket splits its budget differently",
      subtitle: "Household expenditure normalized to 100% per income bracket, 2022",
    },
  },
});

// Lollipop page

export const basicLollipop = defineDemo({
  id: "comparison/lollipop-basic",
  title: "Commute time by metro area",
  source: sourceOf(commuteTimes),
  height: 460,
  spec: {
    mark: "lollipop",
    data: [...commuteTimes.data],
    encoding: {
      x: {
        field: "minutes",
        type: "quantitative",
        axis: { title: "Average one-way commute (minutes)" },
      },
      y: { field: "city", type: "nominal" },
    },
    chrome: {
      title: "New Yorkers commute twice as long as Tulsans",
      subtitle: "Average one-way commute time by major US metro area, 2024 (minutes)",
    },
  },
});

export const divergingLollipop = defineDemo({
  id: "comparison/lollipop-diverging",
  title: "Population change by state",
  source: sourceOf(statePopulationChange),
  height: 460,
  spec: {
    mark: "lollipop",
    data: [...statePopulationChange.data],
    encoding: {
      x: {
        field: "change",
        type: "quantitative",
        axis: { title: "Population change (%)", format: "+.0f" },
      },
      y: { field: "state", type: "nominal" },
    },
    annotations: [{ type: "refline", x: 0, style: "solid", stroke: "#334155", strokeWidth: 1.5 }],
    chrome: {
      title: "Americans keep moving south",
      subtitle: "Percent population change by state, April 2020 to July 2024",
    },
  },
});

export const dumbbellDots = defineDemo({
  id: "comparison/lollipop-dumbbell",
  title: "Life expectancy by gender",
  source: sourceOf(lifeExpectancyGender),
  height: 520,
  spec: {
    mark: "circle",
    data: [...lifeExpectancyGender.data],
    encoding: {
      x: {
        field: "years",
        type: "quantitative",
        axis: { title: "Life expectancy (years)" },
        scale: { zero: false },
      },
      y: { field: "country", type: "nominal" },
      color: { field: "gender", type: "nominal" },
    },
    chrome: {
      title: "Women live longer nearly everywhere, but the gap varies",
      subtitle: "Life expectancy at birth by gender, selected countries, 2023",
    },
  },
});

// Bar list page

export const basicBarList = defineDemo({
  id: "comparison/barlist-basic",
  title: "Programming language popularity",
  source: sourceOf(programmingLanguages),
  height: 520,
  spec: {
    type: "barlist",
    data: [...programmingLanguages.data],
    encoding: {
      label: { field: "language", type: "nominal" },
      value: { field: "pct", type: "quantitative", format: ".1f" },
      color: { field: "category", type: "nominal" },
    },
    chrome: {
      title: "Python leads the pack",
      subtitle: "Programming-language popularity index, % share, 2025",
    },
  },
});

export const groupedBarList = defineDemo({
  id: "comparison/barlist-groups",
  title: "Languages grouped by category",
  source: sourceOf(programmingLanguages),
  height: 640,
  spec: {
    type: "barlist",
    data: [...programmingLanguages.data],
    encoding: {
      group: { field: "category", type: "nominal" },
      label: { field: "language", type: "nominal" },
      value: { field: "pct", type: "quantitative", format: ".1f" },
    },
    chrome: {
      title: "Each category has its own leader",
      subtitle: "Programming-language popularity index by category, % share, 2025",
    },
  },
});

export const compactBarList = defineDemo({
  id: "comparison/barlist-compact",
  title: "A compact top-six list",
  source: sourceOf(programmingLanguages),
  height: 320,
  spec: {
    type: "barlist",
    data: [...programmingLanguages.data],
    encoding: {
      label: { field: "language", type: "nominal" },
      value: { field: "pct", type: "quantitative", format: ".1f" },
    },
    maxItems: 6,
    barHeight: 8,
    cornerRadius: 2,
    chrome: { title: "Top six languages" },
  },
});

export const referenceBarList = defineDemo({
  id: "comparison/barlist-reference",
  title: "A reference line and percent labels",
  source: sourceOf(programmingLanguages),
  height: 520,
  spec: {
    type: "barlist",
    data: [...programmingLanguages.data],
    encoding: {
      label: { field: "language", type: "nominal" },
      value: { field: "pct", type: "quantitative" },
    },
    labels: { format: ".1f", suffix: "%" },
    annotations: [{ type: "refline", x: 10, label: "10% share", style: "dashed" }],
    chrome: {
      title: "Four languages hold more than a tenth of the index each",
      subtitle: "Programming-language popularity index, % share, 2025",
    },
  },
});

// Range page

export const rangeDumbbell = defineDemo({
  id: "comparison/range-dumbbell",
  title: "Life expectancy, 2000 against 2023",
  source: sourceOf(lifeExpectancyChange),
  height: 460,
  spec: {
    mark: "range",
    data: [...lifeExpectancyChange.data],
    encoding: {
      y: { field: "country", type: "nominal", sort: { field: "y2023", order: "ascending" } },
      x: {
        field: "y2000",
        type: "quantitative",
        title: "2000",
        axis: { title: "Life expectancy at birth (years)" },
      },
      x2: { field: "y2023", type: "quantitative", title: "2023" },
    },
    chrome: {
      title: "Everyone is living longer, but the gaps persist",
      subtitle: "Life expectancy at birth, 2000 (gray) vs. 2023 (accent), selected countries",
    },
  },
});

export const rangeArrow = defineDemo({
  id: "comparison/range-arrow",
  title: "US electricity generation shares, 2010 to 2024",
  source: sourceOf(electricityShareChange),
  height: 440,
  spec: {
    mark: { type: "range", style: "arrow", colorByDirection: true },
    data: [...electricityShareChange.data],
    encoding: {
      y: { field: "source", type: "nominal", sort: { field: "y2024", order: "ascending" } },
      x: {
        field: "y2010",
        type: "quantitative",
        title: "2010",
        axis: { title: "Share of US electricity generation (%)" },
      },
      x2: { field: "y2024", type: "quantitative", title: "2024" },
    },
    chrome: {
      title: "Gas and renewables ate coal's lunch",
      subtitle:
        "Share of US electricity generation by source, 2010 to 2024. Green arrows grew, red shrank.",
    },
  },
});

export const rangeBar = defineDemo({
  id: "comparison/range-bar",
  title: "Monthly temperature range in New York",
  source: sourceOf(nycTemperatureRange),
  height: 440,
  spec: {
    mark: { type: "range", style: "bar", fill: ACCENT },
    data: [...nycTemperatureRange.data],
    encoding: {
      x: { field: "month", type: "nominal" },
      y: {
        field: "low",
        type: "quantitative",
        title: "Avg low",
        axis: { title: "Temperature (°C)" },
      },
      y2: { field: "high", type: "quantitative", title: "Avg high" },
    },
    chrome: {
      title: "New York swings 30 degrees across the year",
      subtitle: "Average daily low to high temperature by month, Central Park, 2023",
    },
  },
});

export const rangeHorizontalBar = defineDemo({
  id: "comparison/range-bar-horizontal",
  title: "Life expectancy spans as floating bars",
  source: sourceOf(lifeExpectancyChange),
  height: 460,
  spec: {
    mark: { type: "range", style: "bar", fill: ACCENT },
    data: [...lifeExpectancyChange.data],
    encoding: {
      y: { field: "country", type: "nominal", sort: { field: "y2023", order: "ascending" } },
      x: {
        field: "y2000",
        type: "quantitative",
        title: "2000",
        axis: { title: "Life expectancy at birth (years)" },
      },
      x2: { field: "y2023", type: "quantitative", title: "2023" },
    },
    chrome: {
      title: "Each bar spans a country's gain since 2000",
      subtitle: "Life expectancy at birth, 2000 to 2023, selected countries",
    },
  },
});
