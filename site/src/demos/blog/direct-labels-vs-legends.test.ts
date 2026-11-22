// @vitest-environment node
// The direct-labels post shows its second chart's spec in a `json demo` fence
// so a reader can copy it verbatim. This test pins that fence to the registered
// demo, checks the dataset rows stay unchanged, checks the computed titles, and
// verifies both demos validate and render static light/dark SVGs cleanly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { directLabelsEndpoints, directLabelsLegend } from "./direct-labels-vs-legends";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/direct-labels-vs-legends.mdx"),
  "utf8",
);

describe("the direct labels vs legends post's figures", () => {
  it("writes the endpoint-labels spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${directLabelsEndpoints.source.label}"`);
    expect(JSON.parse(body)).toEqual(directLabelsEndpoints.spec);
  });

  it("plots the dataset's rows unchanged", () => {
    for (const demo of [directLabelsLegend, directLabelsEndpoints]) {
      expect((demo.spec as { data?: unknown }).data, demo.id).toEqual(electricityMixMatrix.data);
    }
  });

  it("titles each chart with a finding read off the rows", () => {
    const title = (demo: typeof directLabelsLegend) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(directLabelsLegend)).toBe(
      "Gas reached 43.5% of US main-source electricity in 2023, ahead of coal at 16.2%",
    );
    expect(title(directLabelsEndpoints)).toBe(
      "US coal fell from 31.2% to 16.2% of main-source generation between 2016 and 2023",
    );
  });

  it("passes spec validation and renders non-null static light/dark SVGs", () => {
    for (const demo of [directLabelsLegend, directLabelsEndpoints]) {
      expect(() => validateDemo(demo.id, demo.spec)).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: "test",
        width: 720,
        height: demo.height ?? 400,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs).toContain('data-theme="light"');
      expect(svgs).toContain('data-theme="dark"');
    }
  });
});
