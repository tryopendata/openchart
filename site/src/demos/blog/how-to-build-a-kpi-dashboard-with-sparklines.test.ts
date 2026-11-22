// @vitest-environment node
// The KPI dashboard post shows its mortgage tile spec in a `json demo` fence so
// a reader can copy it. It must stay the spec the registered demo draws, over
// the dataset modules' rows, and every figure the prose quotes is recomputed
// here from those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eggPricesMonthly } from "@datasets/egg-prices-monthly";
import { mortgageRateWeekly } from "@datasets/mortgage-rate-weekly";
import { remoteJobShare } from "@datasets/remote-job-share";
import { compileChart } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  eggPoints,
  kpiDashboard,
  mortgagePoints,
  mortgageSparkline,
  mortgageTile,
  remotePoints,
  yearAgoOf,
} from "./how-to-build-a-kpi-dashboard-with-sparklines";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-build-a-kpi-dashboard-with-sparklines.mdx"),
  "utf8",
);
const demos = [kpiDashboard, mortgageTile, mortgageSparkline];
type Spec = {
  data?: Record<string, unknown>[];
  metrics?: { label: string; value: string; delta?: string; deltaTone?: string }[];
  chrome?: { title?: string; subtitle?: string };
  overrides?: { compact?: { chrome?: { title?: string; subtitle?: string } } };
};
const specOf = (demo: (typeof demos)[number]) => demo.spec as Spec;

describe("the KPI dashboard post's figures", () => {
  it("writes the mortgage tile's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${mortgageTile.source.label}"`);
    expect(info).toContain(`height=${mortgageTile.height}`);
    expect(JSON.parse(body)).toEqual(mortgageTile.spec);
  });

  it("draws every chart from the dataset modules' rows", () => {
    expect(mortgageRateWeekly.data).toHaveLength(306);
    expect(eggPricesMonthly.data).toHaveLength(69);
    expect(remoteJobShare.data).toHaveLength(31);
    expect(mortgagePoints.map((point) => point.value)).toEqual(
      mortgageRateWeekly.data.map((row) => row.mortgage_rate),
    );
    const since2021 = remoteJobShare.data.filter((row) => Number(row.quarter.slice(0, 4)) >= 2021);
    expect(remotePoints.map((point) => point.value)).toEqual(since2021.map((row) => row.us));
    expect(specOf(mortgageTile).data).toEqual(mortgagePoints);
    expect(specOf(mortgageSparkline).data).toEqual(mortgagePoints);
    const dashboard = specOf(kpiDashboard).data ?? [];
    expect(dashboard).toHaveLength(mortgagePoints.length + eggPoints.length + remotePoints.length);
    expect(new Set(dashboard.map((row) => row.tile))).toEqual(
      new Set([
        "Mortgage rate, weekly, %",
        "Eggs, a dozen, monthly, $",
        "Remote job ads, quarterly, %",
      ]),
    );
  });

  it("breaks the egg line at the one month the source skips", () => {
    const have = new Set(eggPricesMonthly.data.map((row) => row.date));
    const missing = eggPoints.filter((point) => !have.has(point.date));
    expect(missing).toEqual([{ date: "2025-10-01", value: null }]);
    expect(eggPoints).toHaveLength(70);
    for (const row of eggPricesMonthly.data) {
      expect(eggPoints.find((point) => point.date === row.date)?.value).toBe(
        Number(row.eggs_per_dozen.toFixed(2)),
      );
    }
  });

  it("compares each latest reading with the one a year earlier", () => {
    expect(yearAgoOf(mortgagePoints)).toEqual({ date: "2025-11-13", value: 6.24 });
    // No October 2025 egg price, so the comparison falls back to September.
    expect(yearAgoOf(eggPoints)).toEqual({ date: "2025-09-01", value: 3.49 });
    expect(yearAgoOf(remotePoints)).toEqual({ date: "2025-07-01", value: 8.18 });
    expect(specOf(kpiDashboard).metrics).toEqual([
      { label: "vs Nov 13, 2025: 6.24%", value: "7.11%", delta: "+0.87 pts", deltaTone: "up" },
      { label: "vs Sep 2025: $3.49", value: "$2.32", delta: "−$1.17", deltaTone: "down" },
      { label: "vs 2025-Q3: 8.18%", value: "8.58%", delta: "+0.40 pts", deltaTone: "up" },
    ]);
    expect(specOf(kpiDashboard).overrides?.compact?.chrome?.subtitle).toBe(
      "Latest, and change from a year earlier: mortgage rate 7.11% (+0.87 pts), eggs $2.32 (−$1.17), remote job ads 8.58% (+0.40 pts).",
    );
  });

  it("pins the mortgage tile's numbers and its phone title, which keeps unit and period", () => {
    const rows = mortgageRateWeekly.data;
    expect(rows[0]).toEqual({ date: "2021-01-07", mortgage_rate: 2.65 });
    expect(rows.at(-1)).toEqual({ date: "2026-11-12", mortgage_rate: 7.11 });
    const peak = rows.reduce((a, b) => (b.mortgage_rate > a.mortgage_rate ? b : a));
    expect(peak).toEqual({ date: "2023-10-26", mortgage_rate: 7.79 });
    expect(specOf(mortgageTile).metrics).toEqual([
      { label: "Latest, Nov 12, 2026", value: "7.11%", delta: "+0.87 pts", deltaTone: "up" },
      { label: "A year earlier, Nov 13, 2025", value: "6.24%" },
      { label: "Peak, Oct 26, 2023", value: "7.79%" },
    ]);
    expect(specOf(mortgageTile).overrides?.compact?.chrome).toEqual({
      title: "30-year mortgage rate, weekly: 7.11%",
      subtitle: "+0.87 pts from a year earlier (6.24% on Nov 13, 2025). Peak, Oct 26, 2023: 7.79%.",
    });
  });

  it("lays the dashboard out three across on the article column and stacks it on a phone", () => {
    const columns = (width: number) =>
      compileChart(kpiDashboard.spec as Parameters<typeof compileChart>[0], {
        width,
        height: kpiDashboard.height ?? 0,
      }).facet?.columns;
    expect(columns(656)).toBe(3);
    expect(columns(358)).toBe(1);
    // The stacked phone layout fits the stage height, so no panel is cut off.
    const phone = compileChart(kpiDashboard.spec as Parameters<typeof compileChart>[0], {
      width: 328,
      height: kpiDashboard.height ?? 0,
    });
    expect(phone.dimensions.height).toBeLessThanOrEqual(kpiDashboard.height ?? 0);
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of demos) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      expect(demo.height, demo.id).toBeTypeOf("number");
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replaceAll("/", "-"),
        width: demo.width ?? 720,
        height: demo.height ?? 440,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
