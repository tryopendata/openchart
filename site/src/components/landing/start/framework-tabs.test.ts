/** The landing framework tabs: their panels, and how the stored code-tab choice picks one. */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { FRAMEWORKS } from "../../../lib/demo/framework-choice";
import { benchSpec } from "./bench-spec";
import { frameworkPanels } from "./framework-panels";
import { landingTabFor } from "./framework-tabs";

describe("landingTabFor", () => {
  it("keeps a stored wrapper choice and shows React for the docs' Spec tab", () => {
    expect(FRAMEWORKS.map(landingTabFor)).toEqual(["react", "react", "vue", "svelte", "vanilla"]);
  });
});

describe("frameworkPanels", () => {
  const panels = frameworkPanels(benchSpec);

  it("has one panel per wrapper, each installing its own package", () => {
    expect(panels.map(({ id, label, install }) => [id, label, install])).toEqual([
      ["react", "React", "npm install @opendata-ai/openchart-react"],
      ["vue", "Vue", "npm install @opendata-ai/openchart-vue"],
      ["svelte", "Svelte", "npm install @opendata-ai/openchart-svelte"],
      ["vanilla", "Vanilla", "npm install @opendata-ai/openchart-vanilla"],
    ]);
  });

  it("shows each sample with the data rows folded, and copies it with them", () => {
    for (const panel of panels) {
      expect(panel.shown, panel.id).toContain("5 rows");
      expect(panel.shown, panel.id).not.toContain('"capacity": 346');
      expect(panel.code, panel.id).toContain('"capacity": 346');
    }
  });
});

describe("the bench spec", () => {
  it("validates, so the code in every tab renders", () => {
    expect(validateSpec(benchSpec)).toMatchObject({ valid: true, errors: [] });
  });
});
