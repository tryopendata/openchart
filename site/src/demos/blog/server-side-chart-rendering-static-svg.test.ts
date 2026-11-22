// @vitest-environment node
// The server-side rendering post shows the migration spec in a `json demo`
// fence so a reader can copy it. It must stay the spec the registered demo
// draws, over rows computed from the dataset modules. The post also states what
// `renderStaticSVG` does without a DOM, so the test runs it with none.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fhfaStateHpi } from "@datasets/fhfa-state-hpi";
import { irsStateMigration } from "@datasets/irs-state-migration";
import { renderStaticSVG } from "@opendata-ai/openchart-vanilla/static";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { housePriceRange, migrationExtremes } from "./server-side-chart-rendering-static-svg";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/server-side-chart-rendering-static-svg.mdx"),
  "utf8",
);

type Spec = { data?: Record<string, unknown>[]; chrome?: { title?: string } };
const specOf = (demo: { spec: unknown }) => demo.spec as Spec;

describe("the server-side rendering post's figures", () => {
  it("writes the migration spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${migrationExtremes.source.label}"`);
    expect(info).toContain(`height=${migrationExtremes.height}`);
    expect(JSON.parse(body)).toEqual(migrationExtremes.spec);
  });

  it("derives the house price rows from the dataset", () => {
    const rows = specOf(housePriceRange).data ?? [];
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ state: "Maine", change: 85.9 });
    expect(rows.at(-1)).toEqual({ state: "District of Columbia", change: 14.6 });
    const maine = fhfaStateHpi.data.find((row) => row.state === "ME");
    expect(maine?.pct_change_2019q4_2026q2).toBe(85.9);
  });

  it("derives the migration rows from the dataset, signing each as a gain or a loss", () => {
    const rows = specOf(migrationExtremes).data ?? [];
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ state: "Texas", net: 112481, direction: "Net gain" });
    expect(rows.at(-1)).toEqual({ state: "California", net: -200547, direction: "Net loss" });
    const california = irsStateMigration.data.find((row) => row.state === "CA");
    expect(california?.net_2011_12).toBe(-13294);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(housePriceRange).chrome?.title).toBe(
      "House prices rose 85.9% in Maine from 2019 to 2026 and 14.6% in DC",
    );
    expect(specOf(migrationExtremes).chrome?.title).toBe(
      "California lost a net 200,547 people to other states in 2022-23, while Texas gained 112,481",
    );
  });

  it("renders to SVG with no window or document, the same bytes twice, and a label from the title", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    const options = { width: 720, height: 420, idPrefix: "hpi-light", darkMode: "off" } as const;
    const spec = housePriceRange.spec as Parameters<typeof renderStaticSVG>[0];
    const svg = renderStaticSVG(spec, options);
    expect(renderStaticSVG(spec, options)).toBe(svg);
    // The post says "about 15 KB, 2 KB gzipped".
    const bytes = Buffer.byteLength(svg);
    expect(bytes).toBeGreaterThan(14_000);
    expect(bytes).toBeLessThan(16_500);
    const gzipped = gzipSync(svg).length;
    expect(gzipped).toBeGreaterThan(1_500);
    expect(gzipped).toBeLessThan(2_500);
    expect(svg).not.toContain("<script");
    expect(svg).toContain('role="img"');
    expect(svg).toContain(
      'aria-label="Bar chart showing House prices rose 85.9% in Maine from 2019 to 2026 and 14.6% in DC (10 data points)"',
    );
    expect(renderStaticSVG(spec, { ...options, idPrefix: "hpi-dark", darkMode: "force" })).not.toBe(
      svg,
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [housePriceRange, migrationExtremes]) {
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
