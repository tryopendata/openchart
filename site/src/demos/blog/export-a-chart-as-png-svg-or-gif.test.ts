// @vitest-environment node
// The export post shows the fertility spec in a `json demo` fence so a reader
// can copy it. It must stay the spec the registered demo draws, over rows
// computed from the dataset modules, with titles read off those rows. The post
// quotes sizes and dimensions measured on the turnout chart, so the chart's
// layout size is pinned here too.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cdcFertilityByState } from "@datasets/cdc-fertility-by-state";
import { uflVepTurnout } from "@datasets/ufl-vep-turnout";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { fertilityDrops, turnoutGains } from "./export-a-chart-as-png-svg-or-gif";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/export-a-chart-as-png-svg-or-gif.mdx"),
  "utf8",
);

type Spec = { data?: Record<string, unknown>[]; chrome?: { title?: string } };
const specOf = (demo: { spec: unknown }) => demo.spec as Spec;

describe("the export post's figures", () => {
  it("writes the fertility spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${fertilityDrops.source.label}"`);
    expect(info).toContain(`height=${fertilityDrops.height}`);
    expect(JSON.parse(body)).toEqual(fertilityDrops.spec);
  });

  it("derives the turnout gains from the dataset rows", () => {
    const expected = uflVepTurnout.data
      .map((row) => ({
        state: row.state,
        gain: Number((row.turnout_2020 - row.turnout_2016).toFixed(1)),
      }))
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 10);
    expect(specOf(turnoutGains).data).toEqual(expected);
    expect(expected[0]).toEqual({ state: "Hawaii", gain: 12.2 });
    expect(uflVepTurnout.data.every((row) => row.turnout_2020 > row.turnout_2016)).toBe(true);
    expect(uflVepTurnout.data.filter((row) => row.turnout_2024 < row.turnout_2020)).toHaveLength(
      44,
    );
  });

  it("derives the fertility drops from the dataset rows", () => {
    const rows = specOf(fertilityDrops).data ?? [];
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ state: "Utah", rate_2005: 92.8, rate_2024: 59.9 });
    expect(cdcFertilityByState.data.every((row) => row.fertility_2024 < row.fertility_2005)).toBe(
      true,
    );
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(turnoutGains).chrome?.title).toBe(
      "Turnout rose in all 51 jurisdictions from 2016 to 2020, most in Hawaii",
    );
    expect(specOf(fertilityDrops).chrome?.title).toBe(
      "The fertility rate fell in all 51 jurisdictions, from 92.8 to 59.9 in Utah",
    );
  });

  it("gives the turnout chart download buttons and the layout size the post measured", () => {
    expect(turnoutGains.controls?.exports).toEqual(["svg", "png", "csv"]);
    expect(turnoutGains.height).toBe(420);
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [turnoutGains, fertilityDrops]) {
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
