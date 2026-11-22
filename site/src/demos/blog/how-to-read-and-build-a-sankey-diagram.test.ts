// @vitest-environment node
// The Sankey post shows its electricity-generation subset in a `json demo`
// fence so a reader can copy it. It must stay the spec the registered demo
// draws, with LLNL's rows matching the dataset module verbatim.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
import { describe, expect, it } from "vitest";
import { validateDemo } from "../../lib/demo/validate";
import {
  energySankeyElectricity,
  energySankeyFull,
} from "./how-to-read-and-build-a-sankey-diagram";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-read-and-build-a-sankey-diagram.mdx"),
  "utf8",
);

describe("the Sankey post's figures", () => {
  it("writes the electricity subset spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`title="${energySankeyElectricity.title}"`);
    expect(info).toContain(`source="${energySankeyElectricity.source.label}"`);
    expect(info).toContain(` height=${energySankeyElectricity.height}`);
    expect(info).toContain(`phone-height=${energySankeyElectricity.phoneHeight}`);
    expect(JSON.parse(body)).toEqual(energySankeyElectricity.spec);
  });

  it("plots the full dataset unchanged and the exact 15 electricity-generation rows", () => {
    const expectedElectricity = usEnergyFlow2024.data.filter(
      (row) => row.source === "Electricity generation" || row.target === "Electricity generation",
    );
    expect(expectedElectricity).toHaveLength(15);
    expect((energySankeyElectricity.spec as { data?: unknown }).data).toEqual(expectedElectricity);
    expect((energySankeyFull.spec as { data?: unknown }).data).toEqual(usEnergyFlow2024.data);
  });

  it("titles each chart with a finding computed from the rows", () => {
    const title = (demo: typeof energySankeyElectricity) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(energySankeyElectricity)).toBe(
      "Electricity generation lost 59% of its 32.77 quads as rejected energy",
    );
    expect(title(energySankeyFull)).toBe("Rejected energy was 66% of the 94.61 quads used in 2024");
  });

  it("passes demo spec validation for both figures", () => {
    for (const demo of [energySankeyElectricity, energySankeyFull]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
    }
  });
});
