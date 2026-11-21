// @vitest-environment node
// The temperature post shows its first chart's spec in a `json demo` fence,
// written out by hand so a reader can copy it. It must stay the spec the
// registered demo draws, with NASA's rows exactly as the dataset module has them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import { describe, expect, it } from "vitest";
import { gistempBaseline, gistempColumns } from "./how-to-chart-a-temperature-anomaly";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-chart-a-temperature-anomaly.mdx"),
  "utf8",
);

describe("the temperature post's figures", () => {
  it("writes the first chart's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${gistempColumns.source.label}"`);
    expect(JSON.parse(body)).toEqual(gistempColumns.spec);
  });

  it("plots the dataset's rows unchanged", () => {
    for (const demo of [gistempColumns, gistempBaseline]) {
      expect((demo.spec as { data?: unknown }).data, demo.id).toEqual(gistempGlobalAnnual.data);
    }
  });

  it("titles each chart with a finding read off the rows", () => {
    const title = (demo: typeof gistempColumns) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(gistempColumns)).toBe("2025 was 1.19°C warmer than NASA's 1951–1980 average");
    expect(title(gistempBaseline)).toBe("1910 was the coolest year shown, 0.43°C below average");
  });
});
