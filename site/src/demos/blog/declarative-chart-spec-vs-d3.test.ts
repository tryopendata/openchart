// @vitest-environment node
// The declarative-vs-D3 post shows the TypeScript chart's spec in a `json demo`
// fence so a reader can copy it. It must stay the spec the registered demo
// draws, over rows computed from the dataset modules. The post also quotes how
// long the spec and the D3 version are, so the test counts both fences.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blsOccupationWages } from "@datasets/bls-occupation-wages";
import { githubLanguageDevelopers } from "@datasets/github-language-developers";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { occupationPayRanges, typescriptPassesJava } from "./declarative-chart-spec-vs-d3";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/declarative-chart-spec-vs-d3.mdx"),
  "utf8",
);

type Spec = { data?: Record<string, unknown>[]; chrome?: { title?: string } };
const specOf = (demo: { spec: unknown }) => demo.spec as Spec;

describe("the declarative-vs-D3 post's figures", () => {
  it("writes the TypeScript spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${typescriptPassesJava.source.label}"`);
    expect(info).toContain(`height=${typescriptPassesJava.height}`);
    expect(JSON.parse(body)).toEqual(typescriptPassesJava.spec);
  });

  it("counts the lines of the spec and of the D3 version the way the prose says", () => {
    const [, spec = ""] = /^```json demo[^\n]*\n([\s\S]*?)^```$/m.exec(post) ?? [];
    const specLines = spec.split("\n").filter((line) => line.trim() && !/^\s*\{ "date"/.test(line));
    // The data rows go on their own lines; everything else is the spec proper.
    expect(specLines).toHaveLength(45);
    expect(post).toContain("The spec is 45 lines, not counting the 50 data rows");
    const [, d3 = ""] = /^```ts title="chart.ts"\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(d3.trimEnd().split("\n")).toHaveLength(97);
    expect(post).toContain("It takes 97 lines of TypeScript");
  });

  it("derives the language rows from the dataset, one row per quarter and language", () => {
    const rows = specOf(typescriptPassesJava).data ?? [];
    expect(rows).toHaveLength(githubLanguageDevelopers.data.length * 2);
    expect(rows[0]).toEqual({ date: "2020-01-01", language: "TypeScript", pushers: 306095 });
    expect(rows.at(-1)).toEqual({ date: "2026-01-01", language: "Java", pushers: 1074838 });
  });

  it("derives the pay ranges from the dataset, highest median first", () => {
    const rows = specOf(occupationPayRanges).data ?? [];
    expect(rows).toHaveLength(blsOccupationWages.data.length);
    expect(rows.at(-1)).toEqual({ group: "Management", p10: 60130, p90: 257310, role: "Compared" });
    expect(rows.find((row) => row.group === "Food service")).toEqual({
      group: "Food service",
      p10: 23120,
      p90: 51340,
      role: "Compared",
    });
    expect(rows.filter((row) => row.role === "Compared")).toHaveLength(2);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(typescriptPassesJava).chrome?.title).toBe(
      "TypeScript overtook Java in 2023 Q3 and has grown 9.1x since 2020 Q1",
    );
    expect(specOf(occupationPayRanges).chrome?.title).toBe(
      "A food service worker at the 90th percentile earns $51,340, less than a manager at the 10th, $60,130",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [typescriptPassesJava, occupationPayRanges]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replaceAll("/", "-"),
        width: 720,
        height: demo.height ?? 420,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
