// @vitest-environment node
// The table-vs-chart post embeds its table spec in a `json demo` fence so a
// reader can copy it directly. Keep that fence identical to `economiesTable.spec`,
// keep both figures on unchanged `countryIndicators` rows, and verify that both
// specs validate and the bar chart renders its static SVG pair.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countryIndicators } from "@datasets/country-indicators";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { economiesRankedBar, economiesTable } from "./when-to-use-a-table-instead-of-a-chart";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/when-to-use-a-table-instead-of-a-chart.mdx"),
  "utf8",
);

describe("the table-instead-of-a-chart post's figures", () => {
  it("writes the table spec in its json demo fence, citing the dataset and title", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${economiesTable.source.label}"`);
    expect(info).toContain(`title="${economiesTable.title}"`);
    expect(JSON.parse(body)).toEqual(economiesTable.spec);
  });

  it("plots the dataset's rows unchanged", () => {
    for (const demo of [economiesRankedBar, economiesTable]) {
      expect((demo.spec as { data?: unknown }).data, demo.id).toEqual(countryIndicators.data);
    }
  });

  it("titles each figure with findings computed from the rows", () => {
    const title = (demo: typeof economiesRankedBar) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(economiesRankedBar)).toBe(
      "United States GDP per person is $75,489, 7.7 times India's $9,818",
    );
    expect(title(economiesTable)).toBe(
      "India leads on population, United States on income and Japan on longevity",
    );
  });

  it("validates both demos and renders static SVGs for the ranked bar chart", () => {
    for (const demo of [economiesRankedBar, economiesTable]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
    }
    const svgs = staticSvgPair(economiesRankedBar.spec, {
      idPrefix: "test-economies-bar",
      width: 720,
      height: economiesRankedBar.height ?? 440,
    });
    expect(svgs).not.toBeNull();
    expect(svgs).toContain('data-theme="light"');
    expect(svgs).toContain('data-theme="dark"');
  });
});
