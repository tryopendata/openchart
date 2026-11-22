// @vitest-environment node
// The bin-size post shows its $10,000 income spec in a `json demo` fence so a
// reader can copy it. It must stay the spec the registered demo draws, over the
// dataset modules' rows unchanged, and every figure quoted in the prose is
// recomputed here from those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { earthquakeMagnitudes } from "@datasets/earthquake-magnitudes";
import { stateMedianHouseholdIncome } from "@datasets/state-median-household-income";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  binCounts,
  incomeBinFacts,
  incomeTenThousand,
  incomeThousand,
  incomeTwentyFiveThousand,
  quakesHalf,
  quakesTenth,
} from "./histogram-bin-size-how-many-bins";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/histogram-bin-size-how-many-bins.mdx"),
  "utf8",
);
const demos = [
  incomeTwentyFiveThousand,
  incomeTenThousand,
  incomeThousand,
  quakesTenth,
  quakesHalf,
];
const specOf = (demo: (typeof demos)[number]) =>
  demo.spec as {
    data?: Record<string, unknown>[];
    chrome?: { title?: string; subtitle?: string };
  };

const incomes = stateMedianHouseholdIncome.data.map((row) => row.income_2024).sort((a, b) => a - b);

function quantile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.min(low + 1, sorted.length - 1);
  return (sorted[low] ?? 0) + ((sorted[high] ?? 0) - (sorted[low] ?? 0)) * (index - low);
}

describe("the bin-size post's figures", () => {
  it("writes the $10,000 chart's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${incomeTenThousand.source.label}"`);
    expect(info).toContain(`height=${incomeTenThousand.height}`);
    expect(JSON.parse(body)).toEqual(incomeTenThousand.spec);
  });

  it("pins the source rows the prose quotes", () => {
    expect(incomes).toHaveLength(51);
    expect(incomes[0]).toBe(59127);
    expect(incomes.at(-1)).toBe(109707);
    expect(earthquakeMagnitudes.data).toHaveLength(41);
    const count = (bin: number) =>
      earthquakeMagnitudes.data.find((row) => row.magnitude_bin === bin)?.quakes;
    expect(count(3.9)).toBe(8);
    expect(count(4.5)).toBe(94);
    expect(earthquakeMagnitudes.data.reduce((sum, row) => sum + row.quakes, 0)).toBe(1603);
  });

  it("counts the income bins the prose describes", () => {
    expect(incomeBinFacts.coarse).toEqual([15, 30, 6]);
    expect(incomeBinFacts.medium).toEqual([1, 7, 20, 10, 7, 6]);
    expect(incomeBinFacts.fine).toHaveLength(27);
    expect(Math.max(...incomeBinFacts.fine)).toBe(4);
    expect(incomeBinFacts.middleStates).toBe(30);
    expect(binCounts(incomes, 50_000, 10_000).reduce((sum, n) => sum + n, 0)).toBe(51);
  });

  it("matches the two rules of thumb the prose gives", () => {
    const range = (incomes.at(-1) ?? 0) - (incomes[0] ?? 0);
    const sturges = Math.ceil(Math.log2(incomes.length) + 1);
    expect(sturges).toBe(7);
    expect(Math.round(range / sturges / 100) * 100).toBe(7200);
    const iqr = quantile(incomes, 0.75) - quantile(incomes, 0.25);
    const width = (2 * iqr) / incomes.length ** (1 / 3);
    expect(Math.round(width / 100) * 100).toBe(9400);
  });

  it("draws the income charts from the dataset's rows, unchanged", () => {
    const expected = stateMedianHouseholdIncome.data.map((row) => ({
      state: row.state_name,
      income: row.income_2024,
    }));
    for (const demo of [incomeTwentyFiveThousand, incomeTenThousand, incomeThousand]) {
      expect(specOf(demo).data, demo.id).toEqual(expected);
    }
  });

  it("draws the earthquake charts from the dataset's rows and merges 0.5 bins by summing", () => {
    for (const demo of [quakesTenth, quakesHalf]) {
      const stripped = (specOf(demo).data ?? []).map(({ magnitude_to: _to, ...row }) => row);
      expect(stripped, demo.id).toEqual(earthquakeMagnitudes.data);
    }
    const halves = new Map<number, number>();
    for (const row of earthquakeMagnitudes.data) {
      const key = Math.floor((row.magnitude_bin - 2) / 0.5);
      halves.set(key, (halves.get(key) ?? 0) + row.quakes);
    }
    expect([...halves.entries()].sort(([a], [b]) => a - b).map(([, n]) => n)).toEqual([
      19, 474, 260, 91, 275, 312, 139, 24, 8, 1,
    ]);
    for (const row of specOf(quakesTenth).data ?? []) {
      expect(Number(row.magnitude_to) - Number(row.magnitude_bin)).toBeCloseTo(0.1, 10);
    }
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(incomeTwentyFiveThousand).chrome?.title).toBe(
      "With $25,000 bins the 51 states make 3 bars and no shape",
    );
    expect(specOf(incomeTenThousand).chrome?.title).toBe(
      "30 of 51 states sit between $70,000 and $90,000, with a tail to the right",
    );
    expect(specOf(incomeThousand).chrome?.title).toBe(
      "With $1,000 bins there are 27 bars and none holds more than 4 states",
    );
    expect(specOf(quakesTenth).chrome?.title).toBe(
      "Counts fall to 8 at magnitude 3.9, then climb back to 94 at 4.5",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of demos) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      expect(demo.height, demo.id).toBeTypeOf("number");
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replaceAll("/", "-"),
        width: 720,
        height: demo.height ?? 440,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
