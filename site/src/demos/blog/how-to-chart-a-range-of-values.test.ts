// @vitest-environment node
// The range-of-values post shows its range plot spec in a `json demo` fence so
// a reader can copy it. It must stay the spec the registered demo draws, over
// NOAA's Central Park rows unchanged, with midpoints derived directly from the
// same dataset.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { nycTempMidpoint, nycTempRange } from "./how-to-chart-a-range-of-values";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-chart-a-range-of-values.mdx"),
  "utf8",
);

describe("the range-of-values post's figures", () => {
  it("writes the range plot's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${nycTempRange.source.label}"`);
    expect(info).toContain(`height=${nycTempRange.height}`);
    expect(JSON.parse(body)).toEqual(nycTempRange.spec);
  });

  it("plots NOAA's rows unchanged for the range chart and derives midpoints directly from them", () => {
    expect((nycTempRange.spec as { data?: unknown }).data).toEqual(nycTemperatureRange.data);
    const expectedMidpoints = nycTemperatureRange.data.map((row) => ({
      month: row.month,
      midpoint: Number(((row.low + row.high) / 2).toFixed(1)),
    }));
    expect((nycTempMidpoint.spec as { data?: unknown }).data).toEqual(expectedMidpoints);
  });

  it("titles each chart with a finding read off the rows", () => {
    const title = (demo: typeof nycTempRange) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(nycTempMidpoint)).toBe(
      "Monthly midpoints ran from 5.0°C in February to 26.1°C in July",
    );
    expect(title(nycTempRange)).toBe("May swung 10.1°C a day, against 5.6°C in December");
  });

  it("validates both demos and renders light and dark static SVGs", () => {
    for (const demo of [nycTempMidpoint, nycTempRange]) {
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
