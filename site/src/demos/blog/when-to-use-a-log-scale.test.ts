// @vitest-environment node
// The log-scale post embeds its log-axis scatter spec in a `json demo` fence
// so readers can inspect and copy it directly. It must stay identical to the
// registered demo spec, plot `countryIndicators.data` unchanged, and render
// cleanly through both spec validation and the static SVG renderer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countryIndicators } from "@datasets/country-indicators";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { prestonLinearScale, prestonLogScale } from "./when-to-use-a-log-scale";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/when-to-use-a-log-scale.mdx"),
  "utf8",
);

describe("the log-scale post's figures", () => {
  it("writes the log-scale spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${prestonLogScale.source.label}"`);
    expect(info).toContain(`height=${prestonLogScale.height}`);
    expect(JSON.parse(body)).toEqual(prestonLogScale.spec);
  });

  it("plots the dataset's rows unchanged", () => {
    for (const demo of [prestonLinearScale, prestonLogScale]) {
      expect((demo.spec as { data?: unknown }).data, demo.id).toEqual(countryIndicators.data);
    }
  });

  it("titles each chart with a finding read off the rows", () => {
    const title = (demo: typeof prestonLogScale) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(prestonLinearScale)).toBe(
      "GDP per capita runs from $9,818 in India to $75,489 in the United States",
    );
    expect(title(prestonLogScale)).toBe(
      "Life expectancy rises 7 years from India to Brazil, then flattens past Japan",
    );
  });

  it("passes demo validation and renders static light and dark SVGs", () => {
    for (const demo of [prestonLinearScale, prestonLogScale]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        width: 720,
        height: demo.height ?? 440,
        idPrefix: demo.id.replace("/", "-"),
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
