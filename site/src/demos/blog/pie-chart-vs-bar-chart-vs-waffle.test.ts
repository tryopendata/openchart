// @vitest-environment node
// The pie, bar and waffle post shows two specs in `json demo` fences so a
// reader can copy them. Each fence must stay the spec its registered demo draws,
// over the dataset modules' rows, and every title must be read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nyFedHouseholdDebt } from "@datasets/ny-fed-household-debt";
import { ombCompositionOfOutlays } from "@datasets/omb-composition-of-outlays";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  debtBars,
  debtPie,
  outlaysOverTime,
  outlaysWaffle,
} from "./pie-chart-vs-bar-chart-vs-waffle";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/pie-chart-vs-bar-chart-vs-waffle.mdx"),
  "utf8",
);

const fences = [...post.matchAll(/^```json (demo[^\n]*)\n([\s\S]*?)^```$/gm)].map((match) => ({
  info: match[1] ?? "",
  spec: JSON.parse(match[2] ?? "null"),
}));

const titleOf = (demo: { spec: unknown }) =>
  (demo.spec as { chrome?: { title?: string } }).chrome?.title;
const dataOf = (demo: { spec: unknown }) => (demo.spec as { data: Record<string, unknown>[] }).data;

describe("the pie, bar and waffle post's figures", () => {
  it("writes the bar and area specs in its json demo fences, citing their datasets", () => {
    expect(fences).toHaveLength(2);
    for (const [fence, demo] of [
      [fences[0], debtBars],
      [fences[1], outlaysOverTime],
    ] as const) {
      expect(fence?.info).toContain(`source="${demo.source.label}"`);
      expect(fence?.info).toContain(`height=${demo.height}`);
      expect(fence?.spec).toEqual(demo.spec);
    }
  });

  it("draws the pie and the bars from the same latest-year debt balances", () => {
    const latest = nyFedHouseholdDebt.data[nyFedHouseholdDebt.data.length - 1];
    const balances = (demo: { spec: unknown }) =>
      Object.fromEntries(dataOf(demo).map((row) => [row.type, row.balance]));
    expect(balances(debtPie)).toEqual(balances(debtBars));
    expect(balances(debtPie)).toEqual({
      Mortgage: Number(latest?.mortgage.toFixed(2)),
      Auto: Number(latest?.auto.toFixed(2)),
      Student: Number(latest?.student_loan.toFixed(2)),
      Cards: Number(latest?.credit_card.toFixed(2)),
      Other: Number(((latest?.home_equity ?? 0) + (latest?.other ?? 0)).toFixed(2)),
    });
  });

  it("draws the waffle and the area chart from the outlay shares unchanged", () => {
    const rows = ombCompositionOfOutlays.data;
    const last = rows[rows.length - 1];
    expect(dataOf(outlaysWaffle).map((row) => row.share)).toEqual([
      last?.payments_to_individuals_pct,
      Number((100 - (last?.payments_to_individuals_pct ?? 0)).toFixed(1)),
    ]);
    const area = dataOf(outlaysOverTime);
    expect(area).toHaveLength(rows.length * 4);
    expect(
      area.filter((row) => row.category === "National defense").map((row) => row.share),
    ).toEqual(rows.map((row) => row.defense_pct));
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(debtPie)).toBe(
      "Mortgages are 70% of household debt, and the four smaller slices are hard to rank",
    );
    expect(titleOf(debtBars)).toBe(
      "Auto loans ($1.67T) edge student loans ($1.66T), then credit cards",
    );
    expect(titleOf(outlaysWaffle)).toBe(
      "Payments for individuals took 66 of every 100 federal dollars in 2024",
    );
    expect(titleOf(outlaysOverTime)).toBe(
      "Payments for individuals passed defense in 1971 and reached 66% by 2024",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [debtPie, debtBars, outlaysWaffle, outlaysOverTime]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
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
