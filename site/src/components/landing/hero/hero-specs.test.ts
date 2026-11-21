/**
 * Validates and compiles every (form x spotlight) hero spec over the OWID US
 * electricity generation mix dataset, verifies layout/engine invariants for
 * line, small multiples, stacked area and data table, and checks form-aware
 * spec diff behavior.
 */
import type { AreaMark, ChartSpec, TableSpec } from "@opendata-ai/openchart-core";
import { compileChart, compileTable, validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import {
  buildHeroSpec,
  DEFAULT_HERO_FORM,
  DEFAULT_HERO_SPOTLIGHT,
  HERO_FORMS,
  HERO_SPOTLIGHTS,
  type HeroFormId,
  type HeroSpotlight,
  heroFormLabels,
  heroSpecDiff,
  SOURCE_ORDER,
} from "../../../landing/hero";
import { chartTheme } from "../../../lib/demo/chart-theme";

const SIZE = { width: 904, height: 480 };

const ALL_CASES: Array<[HeroFormId, HeroSpotlight]> = HERO_FORMS.flatMap((form) =>
  HERO_SPOTLIGHTS.map((spotlight): [HeroFormId, HeroSpotlight] => [form, spotlight]),
);

const CHART_CASES = ALL_CASES.filter(([form]) => form !== "table");

describe("hero specs", () => {
  it("exports the four editorial forms and seven spotlights with Line + Coal as default", () => {
    expect([...HERO_FORMS]).toEqual(["line", "facets", "area", "table"]);
    expect([...HERO_SPOTLIGHTS]).toEqual([
      "all",
      "Coal",
      "Gas",
      "Nuclear",
      "Wind",
      "Solar",
      "Hydro",
    ]);
    expect(DEFAULT_HERO_FORM).toBe("line");
    expect(DEFAULT_HERO_SPOTLIGHT).toBe("Coal");
    expect(Object.keys(heroFormLabels)).toEqual(["line", "facets", "area", "table"]);
  });

  it.each(ALL_CASES)(
    "buildHeroSpec(%s, %s) passes validateSpec with zero errors",
    (form, spotlight) => {
      const spec = buildHeroSpec(form, spotlight);
      expect(validateSpec(structuredClone(spec)).errors).toEqual([]);
      expect(spec.chrome?.source).toBeUndefined();
    },
  );

  it.each(CHART_CASES)(
    "buildHeroSpec(%s, %s) compiles cleanly with zero series-identification warnings",
    (form, spotlight) => {
      const spec = buildHeroSpec(form, spotlight) as ChartSpec;
      const warnings: string[] = [];
      const layout = compileChart(structuredClone(spec), {
        ...SIZE,
        theme: chartTheme(false),
        onWarn: (message) => warnings.push(message),
      });
      expect(layout.marks.length).toBeGreaterThan(0);
      expect(warnings.filter((w) => w.includes("Both legend and endpointLabels"))).toEqual([]);
    },
  );

  it("line uses label-only endpointLabels + callout when spotlighted, and top legend when all", () => {
    const coal = buildHeroSpec("line", "Coal") as ChartSpec;
    expect(
      coal.encoding.color && "highlight" in coal.encoding.color
        ? coal.encoding.color.highlight
        : undefined,
    ).toEqual(["Coal"]);
    expect(coal.endpointLabels).toEqual({ content: "label" });
    expect(coal.annotations?.length).toBeGreaterThan(0);

    const all = buildHeroSpec("line", "all") as ChartSpec;
    expect(
      all.encoding.color && "highlight" in all.encoding.color
        ? all.encoding.color.highlight
        : undefined,
    ).toBeUndefined();
    expect(all.endpointLabels).toBe(false);
    expect(all.legend).toMatchObject({ position: "top" });
  });

  it("facets reserves no phantom right margin and keeps panels in SOURCE_ORDER", () => {
    const spec = buildHeroSpec("facets", "Coal") as ChartSpec;
    const layout = compileChart(structuredClone(spec), { ...SIZE, theme: chartTheme(false) });
    const rightMargin = layout.dimensions.width - (layout.area.x + layout.area.width);
    expect(rightMargin).toBeLessThan(40);
    expect(layout.facet?.panels.map((panel) => panel.key)).toEqual([...SOURCE_ORDER]);
  });

  it("stacked area normalizes to 100% and gives muted bands soft opacity with canvas seams", () => {
    const spec = buildHeroSpec("area", "Coal") as ChartSpec;
    const lightTheme = chartTheme(false);
    const layout = compileChart(structuredClone(spec), { ...SIZE, theme: lightTheme });
    const areas = layout.marks.filter((mark): mark is AreaMark => mark.type === "area");
    expect(areas).toHaveLength(6);

    const coal = areas.find((mark) => mark.seriesKey === "Coal");
    const muted = areas.filter((mark) => mark.seriesKey !== "Coal");
    expect(coal?.fillOpacity).toBe(0.92);
    expect(muted).toHaveLength(5);
    for (const band of muted) {
      expect(band.fillOpacity).toBe(0.42);
      expect(band.stroke).toBe("#ffffff");
      expect(band.strokeWidth).toBe(1.5);
    }
  });

  it("table compiles cleanly with shared-domain sparklines, neutral signed change, and spotlight tint", () => {
    const coalSpec = buildHeroSpec("table", "Coal") as TableSpec;
    const compiled = compileTable(structuredClone(coalSpec), { ...SIZE, theme: chartTheme(false) });
    expect(compiled.rows).toHaveLength(6);

    const sourceCol = coalSpec.columns.find((col) => col.key === "source");
    const trendCol = coalSpec.columns.find((col) => col.key === "trend");
    const changeCol = coalSpec.columns.find((col) => col.key === "change");
    expect(sourceCol?.categoryColors).toEqual({ Coal: "#0d9488" });
    expect(trendCol?.sparkline).toEqual({ type: "line", domain: "shared" });
    expect(changeCol?.format).toBe("+.1f");
    expect(changeCol?.delta).toBeUndefined();

    const allSpec = buildHeroSpec("table", "all") as TableSpec;
    expect(allSpec.columns.find((col) => col.key === "source")?.categoryColors).toBeUndefined();
    expect(
      compileTable(structuredClone(allSpec), { ...SIZE, theme: chartTheme(false) }).rows,
    ).toHaveLength(6);
  });

  it("heroSpecDiff folds data, marks no lines on line+all, and marks added lines on every other state", () => {
    const baseline = heroSpecDiff("line", "all");
    expect(baseline.hasDiff).toBe(false);
    expect(baseline.teaser.length).toBeGreaterThan(0);
    expect(baseline.lines.some((line) => line.added)).toBe(false);
    expect(baseline.lines.map((line) => line.text).join("\n")).toContain('"data": [ … 48 rows ],');

    for (const [form, spotlight] of ALL_CASES) {
      if (form === "line" && spotlight === "all") continue;
      const diff = heroSpecDiff(form, spotlight);
      expect(diff.hasDiff, `${form}/${spotlight} hasDiff`).toBe(true);
      expect(diff.teaser.length, `${form}/${spotlight} teaser`).toBeGreaterThan(0);
      expect(
        diff.lines.some((line) => line.added),
        `${form}/${spotlight} has added lines`,
      ).toBe(true);
      const expectedRows = form === "table" ? "6 rows" : "48 rows";
      expect(diff.lines.map((line) => line.text).join("\n")).toContain(
        `"data": [ … ${expectedRows} ],`,
      );
    }
  });
});
