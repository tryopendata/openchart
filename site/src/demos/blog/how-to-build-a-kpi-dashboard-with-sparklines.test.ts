// @vitest-environment node
// The KPI dashboard post shows its remote-work tile spec in a `json demo` fence
// so a reader can copy it. It must stay the spec the registered demo draws, over
// the dataset modules' rows, and every figure the prose quotes is recomputed
// here from those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eggPricesMonthly } from "@datasets/egg-prices-monthly";
import { mortgageRateWeekly } from "@datasets/mortgage-rate-weekly";
import { remoteJobShare } from "@datasets/remote-job-share";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  eggPoints,
  eggTile,
  mortgagePoints,
  mortgageSparkline,
  mortgageTile,
  remotePoints,
  remoteTile,
} from "./how-to-build-a-kpi-dashboard-with-sparklines";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-build-a-kpi-dashboard-with-sparklines.mdx"),
  "utf8",
);
const demos = [mortgageSparkline, mortgageTile, eggTile, remoteTile];
type Spec = {
  data?: Record<string, unknown>[];
  metrics?: { label: string; value: string }[];
  chrome?: { title?: string; subtitle?: string };
  overrides?: { compact?: { chrome?: { title?: string; subtitle?: string } } };
};
const specOf = (demo: (typeof demos)[number]) => demo.spec as Spec;

describe("the KPI dashboard post's figures", () => {
  it("writes the remote-work tile's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${remoteTile.source.label}"`);
    expect(info).toContain(`height=${remoteTile.height}`);
    expect(JSON.parse(body)).toEqual(remoteTile.spec);
  });

  it("draws every chart from the dataset modules' rows", () => {
    expect(mortgageRateWeekly.data).toHaveLength(306);
    expect(eggPricesMonthly.data).toHaveLength(69);
    expect(remoteJobShare.data).toHaveLength(31);
    expect(mortgagePoints.map((point) => point.value)).toEqual(
      mortgageRateWeekly.data.map((row) => row.mortgage_rate),
    );
    expect(eggPoints.map((point) => point.date)).toEqual(
      eggPricesMonthly.data.map((row) => row.date),
    );
    const since2021 = remoteJobShare.data.filter((row) => Number(row.quarter.slice(0, 4)) >= 2021);
    expect(remotePoints.map((point) => point.value)).toEqual(since2021.map((row) => row.us));
    expect(specOf(mortgageTile).data).toEqual(mortgagePoints);
    expect(specOf(eggTile).data).toEqual(eggPoints);
    expect(specOf(remoteTile).data).toEqual(remotePoints);
    expect(specOf(mortgageSparkline).data).toEqual(mortgagePoints);
  });

  it("pins the mortgage numbers the prose quotes", () => {
    const rows = mortgageRateWeekly.data;
    expect(rows[0]).toEqual({ date: "2021-01-07", mortgage_rate: 2.65 });
    expect(rows.at(-1)).toEqual({ date: "2026-11-12", mortgage_rate: 7.11 });
    const peak = rows.reduce((a, b) => (b.mortgage_rate > a.mortgage_rate ? b : a));
    expect(peak).toEqual({ date: "2023-10-26", mortgage_rate: 7.79 });
    expect(7.11 / 2.65).toBeGreaterThan(2.5);
    expect(specOf(mortgageTile).metrics).toEqual([
      { label: "Latest, Nov 12, 2026", value: "7.11%" },
      { label: "Start, Jan 7, 2021", value: "2.65%" },
      { label: "Peak, Oct 26, 2023", value: "7.79%" },
    ]);
  });

  it("pins the egg numbers and the one missing month", () => {
    expect(specOf(eggTile).metrics).toEqual([
      { label: "Latest, Oct 2026", value: "$2.32" },
      { label: "Start, Jan 2021", value: "$1.47" },
      { label: "Peak, Mar 2025", value: "$6.23" },
    ]);
    const have = new Set(eggPricesMonthly.data.map((row) => row.date));
    const missing: string[] = [];
    for (let year = 2021; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        const date = `${year}-${String(month).padStart(2, "0")}-01`;
        if (date <= "2026-10-01" && !have.has(date)) missing.push(date);
      }
    }
    expect(missing).toEqual(["2025-10-01"]);
  });

  it("pins the remote-work numbers the prose quotes", () => {
    expect(specOf(remoteTile).metrics?.map((metric) => metric.label)).toEqual([
      "Latest, 2026-Q3",
      "Start, 2021-Q1",
      "Peak, 2022-Q2",
    ]);
    expect(specOf(remoteTile).metrics?.map((metric) => metric.value)).toEqual([
      "8.58%",
      `${remotePoints[0]?.value.toFixed(2)}%`,
      "10.23%",
    ]);
  });

  it("moves the numbers into the title and subtitle at compact width", () => {
    expect(specOf(mortgageTile).overrides?.compact?.chrome).toEqual({
      title: "30-year fixed mortgage rate: 7.11%",
      subtitle: "Jan 7, 2021: 2.65%. Peak, Oct 26, 2023: 7.79%.",
    });
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
