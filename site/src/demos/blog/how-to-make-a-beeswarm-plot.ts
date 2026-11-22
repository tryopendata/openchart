/**
 * The figures in the blog post "How to make a beeswarm plot": the change in
 * average teacher pay for 51 states as a histogram and then as a beeswarm, and
 * the early-career pay of the 125 college majors with at least 5,000 graduates,
 * in one swarm lane per field. Titles
 * state findings computed from the dataset rows so they cannot drift from the
 * data. The post's `json demo` fence repeats `teacherSwarm.spec` verbatim, and a
 * test holds the two together.
 */
import { collegeMajors } from "@datasets/college-majors";
import { teacherSalaryByState } from "@datasets/teacher-salary-by-state";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** Colors as light and dark pairs, so dots and labels keep their contrast on the dark page. */
const ACCENT = { light: "#0e7490", dark: "#22a3c4" };
const LOSS = { light: "#c2364a", dark: "#f07686" };
const MUTED = { light: "#94a3b8", dark: "#7c8aa0" };

const FELL = "Fell";
const ROSE = "Rose";

/** Percent change in constant-dollar pay, 1999-00 to 2021-22, one row per state (the national row is not a state). */
export const teacherChanges = teacherSalaryByState.data
  .filter((row) => row.state !== "United States")
  .map((row) => {
    const change = Number(
      ((100 * (row.salary_2021_22 - row.salary_1999_00)) / row.salary_1999_00).toFixed(1),
    );
    return { state: row.state, change, direction: change < 0 ? FELL : ROSE };
  });

/** The 50 states without DC. Titles count states, so DC (where pay rose) is left out of both numbers. */
const stateChanges = teacherChanges.filter((row) => row.state !== "District of Columbia");
const fell = stateChanges.filter((row) => row.direction === FELL).length;
const biggestFall = teacherChanges.reduce((min, row) => (row.change < min.change ? row : min));

const teacherSource = sourceOf(teacherSalaryByState);
const teacherSubtitle =
  "Change in average public-school teacher salary, constant dollars, 1999-00 to 2021-22";

export const teacherHistogram = defineDemo({
  id: "blog/teacher-pay-histogram",
  title: "Change in teacher pay by state, as a histogram",
  source: teacherSource,
  height: 380,
  spec: {
    mark: { type: "histogram", binCount: 10 },
    data: teacherChanges.map(({ change }) => ({ change })),
    encoding: {
      x: {
        field: "change",
        type: "quantitative",
        axis: { title: "Change in pay", format: ".0f", labelSuffix: "%" },
      },
    },
    theme: { colors: { categorical: [ACCENT] } },
    chrome: {
      title: `Teacher pay fell in ${fell} of ${stateChanges.length} states, but the bars cannot say which`,
      subtitle: `${teacherSubtitle}. Each bar counts states.`,
    },
  },
});

/**
 * The one lane every state sits in. A named lane on `y` gives the annotations
 * a y position to point at; the axis is hidden, so the name never shows.
 */
const LANE = "States";
const biggestRise = teacherChanges.reduce((max, row) => (row.change > max.change ? row : max));
const signed = (change: number) => `${change > 0 ? "+" : ""}${change}%`;
/** A label above each extreme dot, so the chart names the states the prose names. */
const extremeLabel = (row: (typeof teacherChanges)[number]) => ({
  type: "text" as const,
  x: row.change,
  y: LANE,
  text: `**${row.state}**\n${signed(row.change)}`,
  anchor: "top" as const,
  offset: { dx: 0, dy: -12 },
  connector: false,
  dot: false,
});

export const teacherSwarm = defineDemo({
  id: "blog/teacher-pay-beeswarm",
  title: "Change in teacher pay by state, as a beeswarm",
  source: teacherSource,
  height: 360,
  spec: {
    mark: "beeswarm",
    data: teacherChanges.map((row) => ({ ...row, lane: LANE })),
    encoding: {
      x: {
        field: "change",
        type: "quantitative",
        axis: { title: "Change in pay", format: ".0f", labelSuffix: "%" },
      },
      y: { field: "lane", type: "nominal", axis: false },
      color: {
        field: "direction",
        type: "nominal",
        scale: { domain: [FELL, ROSE] },
      },
      // The state names each tooltip; the change is its one row.
      detail: { field: "state", type: "nominal" },
      tooltip: [
        { field: "change", type: "quantitative", title: "Change in pay (%)", format: "+.1f" },
      ],
    },
    annotations: [extremeLabel(biggestFall), extremeLabel(biggestRise)],
    // Phones keep both labels; by default a compact chart moves annotations into tooltips.
    responsive: { compactAnnotationLimit: 2 },
    legend: { show: false },
    theme: { colors: { categorical: [LOSS, ACCENT] } },
    chrome: {
      title: `Teacher pay fell in ${fell} of ${stateChanges.length} states, by as much as ${Math.abs(biggestFall.change)}%`,
      subtitle: `${teacherSubtitle}. One dot per state: red fell, teal rose.`,
    },
  },
});

/** Median early-career pay by major, with the field each major belongs to. */
/** Short words that stay lower case inside a title-cased major name. */
const MINOR_WORDS = new Set(["and", "of", "or", "in", "the", "for", "to"]);
/** "CHEMICAL ENGINEERING" as "Chemical Engineering": the source writes majors in capitals. */
export const titleCase = (name: string) =>
  name
    .toLowerCase()
    .split(" ")
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.replace(/^./, (c) => c.toUpperCase()),
    )
    .join(" ")
    .replace(/\/(.)/g, (_, c: string) => `/${c.toUpperCase()}`);

/** Field names short enough for a lane label on a phone. */
const SHORT_FIELD: Record<string, string> = {
  "Industrial Arts & Consumer Services": "Industrial Arts",
  "Communications & Journalism": "Communications",
  "Humanities & Liberal Arts": "Humanities",
  "Agriculture & Natural Resources": "Agriculture",
  "Biology & Life Science": "Biology",
  "Psychology & Social Work": "Psychology",
  "Computers & Mathematics": "Computers & Math",
};

const baseMajors = collegeMajors.data.map((row) => ({
  major: titleCase(row.major),
  field: SHORT_FIELD[row.major_category] ?? row.major_category,
  pay: row.median_salary,
}));

const fieldsOf = [...new Set(baseMajors.map((row) => row.field))];
const spread = (field: string) => {
  const pays = baseMajors.filter((row) => row.field === field).map((row) => row.pay);
  return { low: Math.min(...pays), high: Math.max(...pays), count: pays.length };
};
/** The field whose majors are spread widest, which the title names. */
export const widestField = fieldsOf.reduce((best, field) => {
  const a = spread(field);
  const b = spread(best);
  return a.high - a.low > b.high - b.low ? field : best;
});
const widest = spread(widestField);
const OTHER = "Other fields";
/** One group name per row: the widest field keeps its own, so it alone gets the accent color. */
const majors = baseMajors.map((row) => ({
  ...row,
  group: row.field === widestField ? widestField : OTHER,
}));
const money = (value: number) => `$${value.toLocaleString("en-US")}`;

export const majorsSwarm = defineDemo({
  id: "blog/majors-pay-beeswarm",
  title: `Median early-career pay of ${majors.length} college majors, by field`,
  source: sourceOf(collegeMajors),
  height: 680,
  spec: {
    mark: "beeswarm",
    data: majors,
    encoding: {
      x: {
        field: "pay",
        type: "quantitative",
        scale: { zero: false },
        axis: {
          title: "Median early-career pay",
          format: "$~s",
          values: [30000, 40000, 50000, 60000],
        },
      },
      y: {
        field: "field",
        type: "nominal",
        sort: { field: "pay", op: "median", order: "ascending" },
      },
      color: {
        field: "group",
        type: "nominal",
        scale: { domain: [widestField, OTHER] },
      },
      // The major names each tooltip; its field and pay are the rows.
      detail: { field: "major", type: "nominal" },
      tooltip: [
        { field: "field", type: "nominal", title: "Field" },
        { field: "pay", type: "quantitative", title: "Median pay", format: "$,.0f" },
      ],
    },
    legend: { show: false },
    theme: { colors: { categorical: [ACCENT, MUTED] } },
    chrome: {
      title: `${widestField} majors range from ${money(widest.low)} to ${money(widest.high)}, the widest spread of any field`,
      subtitle: `Median pay of recent graduates, one dot per major, for all ${majors.length} majors with at least 5,000 graduates`,
    },
  },
});
