/**
 * The figures in the blog post "How to make a beeswarm plot": the change in
 * average teacher pay for 51 states as a histogram and then as a beeswarm, and
 * the early-career pay of 60 college majors in one swarm lane per field. Titles
 * state findings computed from the dataset rows so they cannot drift from the
 * data. The post's `json demo` fence repeats `teacherSwarm.spec` verbatim, and a
 * test holds the two together.
 */
import { collegeMajors } from "@datasets/college-majors";
import { teacherSalaryByState } from "@datasets/teacher-salary-by-state";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";
const LOSS = "#d1495b";

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

const fell = teacherChanges.filter((row) => row.direction === FELL).length;
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
    mark: { type: "histogram", binCount: 10, fill: ACCENT },
    data: teacherChanges.map(({ change }) => ({ change })),
    encoding: {
      x: {
        field: "change",
        type: "quantitative",
        axis: { title: "Change in pay", format: ".0f", labelSuffix: "%" },
      },
    },
    chrome: {
      title: `Teacher pay fell in ${fell} of ${teacherChanges.length} states, but the bars cannot say which`,
      subtitle: `${teacherSubtitle}. Each bar counts states.`,
    },
  },
});

export const teacherSwarm = defineDemo({
  id: "blog/teacher-pay-beeswarm",
  title: "Change in teacher pay by state, as a beeswarm",
  source: teacherSource,
  height: 340,
  spec: {
    mark: "beeswarm",
    data: teacherChanges,
    encoding: {
      x: {
        field: "change",
        type: "quantitative",
        axis: { title: "Change in pay", format: ".0f", labelSuffix: "%" },
      },
      color: {
        field: "direction",
        type: "nominal",
        scale: { domain: [FELL, ROSE], range: [LOSS, ACCENT] },
      },
      tooltip: [
        { field: "state", type: "nominal", title: "State" },
        { field: "change", type: "quantitative", title: "Change in pay (%)" },
      ],
    },
    legend: { show: false },
    chrome: {
      title: `Teacher pay fell in ${fell} of ${teacherChanges.length} states, by as much as ${Math.abs(biggestFall.change)}%`,
      subtitle: `${teacherSubtitle}. One dot per state: red fell, blue rose.`,
    },
  },
});

/** Median early-career pay by major, with the field each major belongs to. */
const baseMajors = collegeMajors.data.map((row) => ({
  major: row.major,
  field: row.major_category,
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
  title: "Median early-career pay of 60 college majors, by field",
  source: sourceOf(collegeMajors),
  height: 640,
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
          values: [35000, 45000, 55000, 65000],
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
        scale: { domain: [widestField, OTHER], range: [ACCENT, "#94a3b8"] },
      },
      tooltip: [
        { field: "major", type: "nominal", title: "Major" },
        { field: "pay", type: "quantitative", title: "Median pay ($)" },
      ],
    },
    legend: { show: false },
    chrome: {
      title: `${widestField} majors range from ${money(widest.low)} to ${money(widest.high)}, the widest spread of any field`,
      subtitle:
        "Median pay of recent graduates, one dot per major, for the 60 majors with at least 5,000 graduates",
    },
  },
});
