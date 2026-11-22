// @vitest-environment node
// The accessible-charts post shows the overdose spec, with its authored text
// alternative, in a `json demo` fence so a reader can copy it. It must stay the
// spec the registered demo draws, over rows computed from the CDC and nflverse
// dataset modules, and the alternative text must say what the rows say.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cdcOverdoseByDrug } from "@datasets/cdc-overdose-by-drug";
import { nflHomeAdvantage } from "@datasets/nfl-home-advantage";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { nflHomeGenerated, overdoseAccessible } from "./accessible-charts-for-the-web";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/accessible-charts-for-the-web.mdx"),
  "utf8",
);

type Spec = { data?: unknown[]; chrome?: { title?: string }; a11y?: { description?: string } };
const specOf = (demo: { spec: unknown }) => demo.spec as Spec;

describe("the accessible-charts post's figures", () => {
  it("writes the overdose spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${overdoseAccessible.source.label}"`);
    expect(info).toContain(`height=${overdoseAccessible.height}`);
    expect(JSON.parse(body)).toEqual(overdoseAccessible.spec);
  });

  it("plots the dataset rows unchanged", () => {
    const expected = cdcOverdoseByDrug.data.flatMap((row) => [
      { year: String(row.year), drug: "Synthetic opioids", deaths: row.synthetic_opioids },
      { year: String(row.year), drug: "Heroin", deaths: row.heroin },
    ]);
    expect(specOf(overdoseAccessible).data).toEqual(expected);
    expect(specOf(nflHomeGenerated).data).toEqual(
      nflHomeAdvantage.data.map((row) => ({
        season: String(row.season),
        home_win_pct: row.home_win_pct,
      })),
    );
  });

  it("titles each chart with a finding and describes the overdose chart from the rows", () => {
    expect(specOf(overdoseAccessible).chrome?.title).toBe(
      "Synthetic opioids passed heroin in 2016 and peaked at 74,829 deaths in 2022",
    );
    expect(specOf(overdoseAccessible).a11y?.description).toBe(
      "Synthetic opioid overdose deaths passed heroin deaths in 2016, 19,500 to 15,551, and peaked at 74,829 in 2022. By 2025 they had fallen 49% from the peak, to 38,462.",
    );
    expect(specOf(nflHomeGenerated).chrome?.title).toBe(
      "NFL home teams won 59.7% of games in 1999 and 49.8% in 2020",
    );
    expect(specOf(nflHomeGenerated).a11y).toBeUndefined();
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [overdoseAccessible, nflHomeGenerated]) {
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
