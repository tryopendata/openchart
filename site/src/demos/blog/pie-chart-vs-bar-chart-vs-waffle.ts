/**
 * The figures in the blog post "Pie chart vs bar chart vs waffle": household
 * debt as a two-slice donut (mortgages and the rest) and by type as sorted bars, the 2024 split of federal
 * outlays as a waffle, and that split over 1962-2024 as a 100% stacked area.
 * Titles state findings computed from the dataset rows so they cannot drift
 * from the data. The post's `json demo` fences repeat `debtBars.spec` and
 * `outlaysOverTime.spec` verbatim, and a test holds them together.
 */
import { nyFedHouseholdDebt } from "@datasets/ny-fed-household-debt";
import { ombCompositionOfOutlays } from "@datasets/omb-composition-of-outlays";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The row at the given index of a dataset the demo cannot be built without. */
function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new Error(`The ${what} dataset has no such row.`);
  return row;
}

// Light and dark values for each color, so labels drawn in a series color keep
// 4.5:1 on the page in both site themes. A plain hex renders verbatim in dark.
const TEAL = { light: "#0e7490", dark: "#22a3c4" };
const ORANGE = { light: "#c2410c", dark: "#fb923c" };
const PURPLE = { light: "#7c3aed", dark: "#a78bfa" };
const GRAY = { light: "#9ca3af", dark: "#6b7280" };

const debt = nyFedHouseholdDebt.data;
const latestDebt = must(debt[debt.length - 1], "household debt");

const trillions = (value: number) => Number(value.toFixed(2));

export const mortgageShare = Math.round((latestDebt.mortgage / latestDebt.total) * 100);
/** The New York Fed's own "other" category as a share of all household debt, one decimal. */
export const otherSharePct = Number(((latestDebt.other / latestDebt.total) * 100).toFixed(1));

export const debtPie = defineDemo({
  id: "blog/debt-pie",
  title: "US household debt, mortgages and all other debt, as a donut",
  source: sourceOf(nyFedHouseholdDebt),
  height: 380,
  spec: {
    // The share is printed in the hole. Slice labels are off: the engine currently
    // draws a left-hand leader label a full text width away from its slice, and a
    // two-slice pie always has one slice on the left.
    mark: {
      type: "arc",
      innerRadius: 0.6,
      centerLabel: { text: `${mortgageShare}%`, subtitle: "mortgages" },
    },
    data: [
      { type: "Mortgages", balance: trillions(latestDebt.mortgage) },
      { type: "All other debt", balance: trillions(latestDebt.total - latestDebt.mortgage) },
    ],
    encoding: {
      theta: { field: "balance", type: "quantitative" },
      color: { field: "type", type: "nominal", scale: { domain: ["Mortgages", "All other debt"] } },
    },
    labels: { density: "none" },
    legend: { position: "bottom" },
    theme: { colors: { categorical: [TEAL, GRAY] } },
    chrome: {
      title: `Mortgages are ${mortgageShare}% of US household debt`,
      subtitle: `Share of $${latestDebt.total.toFixed(1)} trillion in US household debt, fourth quarter of ${latestDebt.year}`,
    },
  },
});

// Home equity lines and the New York Fed's "other" are each about 3% or less of the
// total, so they are merged into one row rather than drawn as two slivers.
const byBalance = [
  { type: "Mortgage", balance: trillions(latestDebt.mortgage) },
  { type: "Auto", balance: trillions(latestDebt.auto) },
  { type: "Student", balance: trillions(latestDebt.student_loan) },
  { type: "Cards", balance: trillions(latestDebt.credit_card) },
  { type: "Other", balance: trillions(latestDebt.home_equity + latestDebt.other) },
].sort((a, b) => b.balance - a.balance);
// The title and prose name auto, student and card debt in this order, so fail if the rows stop agreeing.
if (byBalance.map((row) => row.type).join() !== "Mortgage,Auto,Student,Cards,Other") {
  throw new Error(
    "The debt bar title assumes the balances rank Mortgage, Auto, Student, Cards, Other.",
  );
}
// From the unrounded balances: subtracting the two-decimal bar values would drop a cent of the gap.
export const studentOverCards = trillions(latestDebt.student_loan - latestDebt.credit_card);

export const debtBars = defineDemo({
  id: "blog/debt-bars",
  title: "US household debt by type as sorted bars",
  source: sourceOf(nyFedHouseholdDebt),
  height: 380,
  spec: {
    mark: "bar",
    data: byBalance,
    encoding: {
      x: { field: "balance", type: "quantitative", axis: { title: "$ trillions", format: ".0f" } },
      y: { field: "type", type: "nominal", sort: "x" },
    },
    labels: { format: ".2f" },
    theme: { colors: { categorical: [TEAL] } },
    chrome: {
      title: `Student loan debt exceeds credit card debt by $${studentOverCards.toFixed(2)} trillion`,
      subtitle: `US household debt by type, fourth quarter of ${latestDebt.year}, $ trillions`,
    },
  },
});

const outlays = ombCompositionOfOutlays.data;
const lastOutlays = must(outlays[outlays.length - 1], "federal outlays");

export const outlaysWaffle = defineDemo({
  id: "blog/outlays-waffle",
  title: "Federal outlays in the latest year as a waffle",
  source: sourceOf(ombCompositionOfOutlays),
  height: 460,
  spec: {
    mark: "waffle",
    data: [
      { category: "Payments for individuals", share: lastOutlays.payments_to_individuals_pct },
      {
        category: "All other outlays",
        share: Number((100 - lastOutlays.payments_to_individuals_pct).toFixed(1)),
      },
    ],
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "category", type: "nominal", highlight: "Payments for individuals" },
    },
    theme: { colors: { categorical: [TEAL] } },
    chrome: {
      title: `Payments for individuals were ${Math.round(lastOutlays.payments_to_individuals_pct)}% of federal spending in ${lastOutlays.year}`,
      subtitle: `Share of US federal outlays by category, fiscal year ${lastOutlays.year}. Each square is one percent.`,
    },
  },
});

const CATEGORIES = [
  { key: "payments_to_individuals_pct", label: "Payments for individuals", color: TEAL },
  { key: "defense_pct", label: "National defense", color: ORANGE },
  { key: "net_interest_pct", label: "Net interest", color: PURPLE },
  { key: "everything_else_pct", label: "Everything else", color: GRAY },
] as const;

const outlayRows = outlays.flatMap((row) =>
  CATEGORIES.map((category) => ({
    date: `${row.year}-01-01`,
    category: category.label,
    share: row[category.key],
  })),
);

const firstFlip = outlays.find((row) => row.payments_to_individuals_pct > row.defense_pct);
const first = must(outlays[0], "federal outlays");

export const outlaysOverTime = defineDemo({
  id: "blog/outlays-over-time",
  title: "Federal outlays by category, 1962 to 2024",
  source: sourceOf(ombCompositionOfOutlays),
  height: 460,
  spec: {
    mark: { type: "area", interpolate: "linear" },
    data: outlayRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
      y: {
        field: "share",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of outlays", format: ".0%", grid: true },
      },
      color: {
        field: "category",
        type: "nominal",
        scale: { domain: CATEGORIES.map((category) => category.label) },
      },
    },
    theme: { colors: { categorical: CATEGORIES.map((category) => category.color) } },
    legend: { position: "top" },
    chrome: {
      title: `Payments for individuals passed defense in ${firstFlip?.year} and reached ${lastOutlays.payments_to_individuals_pct}% by ${lastOutlays.year}`,
      subtitle: `Share of US federal outlays by category, fiscal years ${first.year} to ${lastOutlays.year}`,
    },
  },
});
