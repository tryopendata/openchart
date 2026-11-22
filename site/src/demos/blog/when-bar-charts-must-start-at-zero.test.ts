// @vitest-environment node
// The baseline post shows its zero-anchored bar chart's spec in a `json demo`
// fence, written out by hand so a reader can copy it. It must stay the spec
// the registered demo draws, with rows unchanged from the tier-1 datasets, and
// the truncated bar demo must actually start its axis above zero in SVG.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { populationByCountry } from "@datasets/population";
import { usInflation } from "@datasets/us-inflation";
import { describe, expect, it } from "vitest";
import { staticSvg, staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  baselineBarsTruncated,
  baselineBarsZero,
  baselineLineZoomed,
} from "./when-bar-charts-must-start-at-zero";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/when-bar-charts-must-start-at-zero.mdx"),
  "utf8",
);

const underOneBillion = populationByCountry.data.filter((row) => row.population < 1_000_000_000);
const recentInflation = usInflation.data.filter(
  (row) => row.date >= "2021-04-01" && row.date <= "2024-10-01",
);

/** Pixel widths of horizontal bar `<path>` marks (rounded-right bars) in a static SVG. */
function barWidths(svg: string): number[] {
  return [...svg.matchAll(/<path\b[^>]*d="M([\d.]+),[\d.]+\s+H([\d.]+)\s+A([\d.]+),/g)].map(
    ([, startX, flatEndX, radius]) => Number(flatEndX) + Number(radius) - Number(startX),
  );
}

describe("the zero-baseline post's figures", () => {
  it("writes the zero-baseline bar spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${baselineBarsZero.source.label}"`);
    expect(info).toContain(`height=${baselineBarsZero.height}`);
    expect(JSON.parse(body)).toEqual(baselineBarsZero.spec);
  });

  it("plots unchanged rows from its tier-1 dataset slices", () => {
    for (const demo of [baselineBarsTruncated, baselineBarsZero]) {
      expect((demo.spec as { data?: unknown }).data, demo.id).toEqual(underOneBillion);
    }
    expect((baselineLineZoomed.spec as { data?: unknown }).data, baselineLineZoomed.id).toEqual(
      recentInflation,
    );
  });

  it("titles each chart with a finding computed from the rows", () => {
    const title = (demo: typeof baselineBarsZero) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(baselineBarsTruncated)).toBe(
      "Starting at 100M makes Indonesia's bar 5.3x Ethiopia's instead of 2.1x",
    );
    expect(title(baselineBarsZero)).toBe(
      "Indonesia's population is 2.1x Ethiopia's (285M vs 135M)",
    );
    expect(title(baselineLineZoomed)).toBe(
      "US inflation peaked at 8.5% in 2022 and eased to 2.6% by late 2024",
    );
  });

  it("validates all three demos and renders non-null static SVG pairs", () => {
    for (const demo of [baselineBarsTruncated, baselineBarsZero, baselineLineZoomed]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      const pair = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replace("/", "-"),
        width: 720,
        height: demo.height ?? 400,
      });
      expect(pair, demo.id).not.toBeNull();
      expect(pair?.match(/<svg\b/g)?.length, demo.id).toBe(2);
    }
  });

  it("actually truncates the first bar chart at 100M and keeps zero off the zoomed line", () => {
    const truncatedSvg = staticSvg(structuredClone(baselineBarsTruncated.spec), {
      idPrefix: "truncated-check",
      width: 720,
      height: 400,
      dark: false,
    });
    const zeroSvg = staticSvg(structuredClone(baselineBarsZero.spec), {
      idPrefix: "zero-check",
      width: 720,
      height: 400,
      dark: false,
    });
    const lineSvg = staticSvg(structuredClone(baselineLineZoomed.spec), {
      idPrefix: "line-check",
      width: 720,
      height: 400,
      dark: false,
    });

    expect(truncatedSvg).not.toBeNull();
    expect(zeroSvg).not.toBeNull();
    expect(lineSvg).not.toBeNull();

    // Bars sort descending by population: index 1 is Indonesia (285M), index 7 is Ethiopia (135M).
    const truncatedWidths = barWidths(truncatedSvg ?? "");
    const zeroWidths = barWidths(zeroSvg ?? "");
    expect(truncatedWidths).toHaveLength(8);
    expect(zeroWidths).toHaveLength(8);

    const truncatedRatio = (truncatedWidths[1] ?? 0) / (truncatedWidths[7] ?? 1);
    const zeroRatio = (zeroWidths[1] ?? 0) / (zeroWidths[7] ?? 1);
    expect(truncatedRatio).toBeGreaterThan(5.0);
    expect(truncatedRatio).toBeLessThan(5.6);
    expect(zeroRatio).toBeGreaterThan(2.0);
    expect(zeroRatio).toBeLessThan(2.2);

    // Truncated axis starts at 100M with no 0 tick; zero-baseline axis includes 0.
    expect(truncatedSvg).toContain(">100M<");
    expect(truncatedSvg).not.toContain(">0<");
    expect(zeroSvg).toContain(">0<");

    // Zoomed inflation line (2.6% to 8.5%) omits 0.0% from its y-axis ticks.
    expect(lineSvg).not.toContain(">0.0%<");
    expect(lineSvg).not.toContain(">0%<");
  });
});
