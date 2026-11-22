// @vitest-environment node
// The responsive-charts post shows the import-share spec in a `json demo` fence
// so a reader can copy it. It must stay the spec the registered demo draws,
// over rows computed from the dataset modules, and the phone figure must be
// the same spec as the full-width one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mlbHitsVsStrikeouts } from "@datasets/mlb-hits-vs-strikeouts";
import { usImportShares } from "@datasets/us-import-shares";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  importSharesResponsive,
  mlbStrikeoutsFull,
  mlbStrikeoutsPhone,
} from "./responsive-charts-on-mobile";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/responsive-charts-on-mobile.mdx"),
  "utf8",
);

type Spec = { data?: unknown[]; chrome?: { title?: string } };
const specOf = (demo: { spec: unknown }) => demo.spec as Spec;

describe("the responsive-charts post's figures", () => {
  it("writes the import-share spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${importSharesResponsive.source.label}"`);
    expect(info).toContain(`height=${importSharesResponsive.height}`);
    expect(JSON.parse(body)).toEqual(importSharesResponsive.spec);
  });

  it("plots the dataset rows unchanged, one row per season and measure", () => {
    const expected = mlbHitsVsStrikeouts.data.flatMap((row) => [
      { year: String(row.year), measure: "Strikeouts", count: row.strikeouts },
      { year: String(row.year), measure: "Hits", count: row.hits },
    ]);
    expect(specOf(mlbStrikeoutsFull).data).toEqual(expected);
    const shares = usImportShares.data.flatMap((row) => [
      { year: String(row.year), partner: "China", share: row.china_pct },
      { year: String(row.year), partner: "Mexico", share: row.mexico_pct },
      { year: String(row.year), partner: "Canada", share: row.canada_pct },
    ]);
    expect(specOf(importSharesResponsive).data).toEqual(shares);
  });

  it("draws the phone figure from the full-width figure's spec at 360px", () => {
    expect(mlbStrikeoutsPhone.spec).toEqual(mlbStrikeoutsFull.spec);
    expect(mlbStrikeoutsPhone.width).toBe(360);
    expect(mlbStrikeoutsFull.width).toBeUndefined();
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(mlbStrikeoutsFull).chrome?.title).toBe(
      "Strikeouts passed hits in 2018 and have stayed ahead",
    );
    expect(specOf(importSharesResponsive).chrome?.title).toBe(
      "China's share of US goods imports peaked at 20.4% in 2020; Mexico passed it in 2023",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [mlbStrikeoutsFull, mlbStrikeoutsPhone, importSharesResponsive]) {
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
