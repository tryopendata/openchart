/**
 * The figures in the blog post "Pie chart vs bar chart vs waffle": household
 * debt by type as a pie and then a sorted bar chart, the 2024 split of federal
 * outlays as a waffle, and that split over 1962-2024 as a 100% stacked area.
 * Titles state findings computed from the dataset rows so they cannot drift
 * from the data. The post's `json demo` fences repeat `debtBars.spec` and
 * `outlaysOverTime.spec` verbatim, and a test holds them together.
 */
import { nyFedHouseholdDebt } from "@datasets/ny-fed-household-debt";
import { ombCompositionOfOutlays } from "@datasets/omb-composition-of-outlays";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const BLUE = "#0e7490";

const debt = nyFedHouseholdDebt.data;
const latestDebt = debt[debt.length - 1];

const trillions = (value: number) => Number(value.toFixed(2));

// Home equity lines and "other" are each under 3% of the total, so they are merged
// into one slice here rather than left to the pie's automatic small-slice grouping.
const debtRows = [
  { type: "Mortgage", balance: trillions(latestDebt.mortgage) },
  { type: "Auto", balance: trillions(latestDebt.auto) },
  { type: "Student", balance: trillions(latestDebt.student_loan) },
  { type: "Cards", balance: trillions(latestDebt.credit_card) },
  { type: "Other", balance: trillions(latestDebt.home_equity + latestDebt.other) },
];

export const mortgageShare = Math.round((latestDebt.mortgage / latestDebt.total) * 100);

export const debtPie = defineDemo({
  id: "blog/debt-pie",
  title: "US household debt by type as a pie",
  source: sourceOf(nyFedHouseholdDebt),
  height: 420,
  spec: {
    mark: "arc",
    data: debtRows,
    encoding: {
      theta: { field: "balance", type: "quantitative" },
      color: { field: "type", type: "nominal" },
    },
    labels: { density: "none" },
    legend: { position: "bottom" },
    chrome: {
      title: `Mortgages are ${mortgageShare}% of household debt, and the four smaller slices are hard to rank`,
      subtitle: `Share of $${latestDebt.total.toFixed(1)} trillion in US household debt, fourth quarter of ${latestDebt.year}`,
    },
  },
});

const byBalance = [...debtRows].sort((a, b) => b.balance - a.balance);
const balanceOf = (type: string) => byBalance.find((row) => row.type === type)?.balance;
// The title names auto, student and card debt in this order, so fail if the rows stop agreeing.
if (byBalance.map((row) => row.type).join() !== "Mortgage,Auto,Student,Cards,Other") {
  throw new Error(
    "The debt bar title assumes the balances rank Mortgage, Auto, Student, Cards, Other.",
  );
}

export const debtBars = defineDemo({
  id: "blog/debt-bars",
  title: "US household debt by type as sorted bars",
  source: sourceOf(nyFedHouseholdDebt),
  height: 380,
  spec: {
    mark: { type: "bar", fill: BLUE },
    data: byBalance,
    encoding: {
      x: { field: "balance", type: "quantitative", axis: { title: "$ trillions", format: ".0f" } },
      y: { field: "type", type: "nominal", sort: "x" },
    },
    labels: { format: ".2f" },
    chrome: {
      title: `Auto loans ($${balanceOf("Auto")}T) edge student loans ($${balanceOf("Student")}T), then credit cards`,
      subtitle: `US household debt by type, fourth quarter of ${latestDebt.year}, $ trillions`,
    },
  },
});

const outlays = ombCompositionOfOutlays.data;
const lastOutlays = outlays[outlays.length - 1];

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
        category: "Everything else",
        share: Number((100 - lastOutlays.payments_to_individuals_pct).toFixed(1)),
      },
    ],
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "category", type: "nominal", highlight: "Payments for individuals" },
    },
    chrome: {
      title: `Payments for individuals took ${Math.round(lastOutlays.payments_to_individuals_pct)} of every 100 federal dollars in ${lastOutlays.year}`,
      subtitle: `Share of US federal outlays by category, fiscal year ${lastOutlays.year}. Each square is one percent.`,
    },
  },
});

const CATEGORIES = [
  { key: "payments_to_individuals_pct", label: "Payments for individuals", color: BLUE },
  { key: "defense_pct", label: "National defense", color: "#e07b39" },
  { key: "net_interest_pct", label: "Net interest", color: "#7c3aed" },
  { key: "everything_else_pct", label: "Everything else", color: "#9ca3af" },
] as const;

const outlayRows = outlays.flatMap((row) =>
  CATEGORIES.map((category) => ({
    date: `${row.year}-01-01`,
    category: category.label,
    share: row[category.key],
  })),
);

const firstFlip = outlays.find((row) => row.payments_to_individuals_pct > row.defense_pct);
const first = outlays[0];

export const outlaysOverTime = defineDemo({
  id: "blog/outlays-over-time",
  title: "Federal outlays by category, 1962 to 2024",
  source: sourceOf(ombCompositionOfOutlays),
  height: 460,
  spec: {
    mark: "area",
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
        scale: {
          domain: CATEGORIES.map((category) => category.label),
          range: CATEGORIES.map((category) => category.color),
        },
      },
    },
    legend: { position: "top" },
    chrome: {
      title: `Payments for individuals passed defense in ${firstFlip?.year} and reached ${lastOutlays.payments_to_individuals_pct}% by ${lastOutlays.year}`,
      subtitle: `Share of US federal outlays by category, fiscal years ${first.year} to ${lastOutlays.year}`,
    },
  },
});
