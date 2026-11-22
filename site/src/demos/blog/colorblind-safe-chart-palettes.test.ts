// @vitest-environment node
// The colorblind-safe palettes post writes its first chart's spec in a
// `json demo` fence so readers can copy it. It must match the registered demo's
// spec verbatim, both demos must plot unchanged tier-1 data with computed
// titles, and both must validate and render static light/dark SVGs cleanly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { accessiblePaletteLines, accessibleSequentialMap } from "./colorblind-safe-chart-palettes";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/colorblind-safe-chart-palettes.mdx"),
  "utf8",
);

describe("the colorblind-safe palettes post's figures", () => {
  it("writes the first chart's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${accessiblePaletteLines.source.label}"`);
    expect(info).toContain(`height=${accessiblePaletteLines.height}`);
    expect(JSON.parse(body)).toEqual(accessiblePaletteLines.spec);
  });

  it("plots each dataset's rows unchanged", () => {
    expect((accessiblePaletteLines.spec as { data?: unknown }).data).toEqual(
      electricityMixMatrix.data,
    );
    expect((accessibleSequentialMap.spec as { data?: unknown }).data).toEqual(
      usStateUnemployment.data,
    );
  });

  it("titles each chart with a finding computed from the rows", () => {
    const titleOf = (demo: typeof accessiblePaletteLines) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(titleOf(accessiblePaletteLines)).toBe(
      "Gas rose to 43.5% in 2023 and coal fell to 16.2%",
    );
    expect(titleOf(accessibleSequentialMap)).toBe(
      "State unemployment runs from 2.3% in South Dakota to 5.7% in DC",
    );
  });

  it("validates both demos and renders light and dark static SVGs cleanly", () => {
    for (const demo of [accessiblePaletteLines, accessibleSequentialMap]) {
      expect(() => validateDemo(demo.id, demo.spec)).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replace("/", "-"),
        width: 720,
        height: demo.height ?? 400,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
