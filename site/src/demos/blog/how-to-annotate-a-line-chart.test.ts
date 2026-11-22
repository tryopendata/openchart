// @vitest-environment node
// The line-annotation post embeds the annotated CPI chart's spec in a
// `json demo` fence so a reader can copy it directly. It must stay the exact
// spec the registered demo draws, using usInflation.data unchanged.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { usInflation } from "@datasets/us-inflation";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { inflationAnnotated, inflationBare } from "./how-to-annotate-a-line-chart";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-annotate-a-line-chart.mdx"),
  "utf8",
);

describe("the line-annotation post's figures", () => {
  it("writes the annotated chart's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${inflationAnnotated.source.label}"`);
    expect(info).toContain(`height=${inflationAnnotated.height}`);
    expect(JSON.parse(body)).toEqual(inflationAnnotated.spec);
  });

  it("plots the dataset's rows unchanged", () => {
    for (const demo of [inflationBare, inflationAnnotated]) {
      expect((demo.spec as { data?: unknown }).data, demo.id).toEqual(usInflation.data);
    }
  });

  it("titles each chart with a finding read off the rows", () => {
    const title = (demo: typeof inflationBare) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(inflationBare)).toBe(
      "US inflation peaked at 8.5% in Q3 2022 and ended 2024 at 2.6%",
    );
    expect(title(inflationAnnotated)).toBe(
      "US inflation stayed above 5% for seven quarters and peaked at 8.5% in Q3 2022",
    );
  });

  it("validates both demos and renders static SVG pairs cleanly", () => {
    for (const demo of [inflationBare, inflationAnnotated]) {
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
