/**
 * The scroll story's steps: each cumulative spec the story can reach passes the
 * engine's validator, the opening step changes nothing and the four after it
 * make the changes the section promises, and each step's plain-words line says
 * what its change does.
 */
import { deepMergeSpec } from "@opendata-ai/openchart-core";
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { storyBaseSpec, storySteps } from "../../../landing/story";
import { describeChange } from "./story-change";

const changes = storySteps.map((step) => step.change);

/** The spec the chart shows at step `index`, merged the way createChartStory merges it. */
const specAt = (index: number) =>
  changes
    .slice(0, index + 1)
    .reduce((spec, change) => deepMergeSpec(spec, change.spec ?? {}), storyBaseSpec);

describe("the story steps", () => {
  it("are an opening and four changes, with unique ids and prose", () => {
    expect(storySteps).toHaveLength(5);
    expect(new Set(storySteps.map((step) => step.id)).size).toBe(5);
    for (const step of storySteps) expect(step.prose.length).toBeGreaterThan(40);
  });

  it.each(storySteps.map((step, index) => [step.id, index] as const))(
    "reach a valid spec at step %s",
    (_id, index) => {
      const result = validateSpec(specAt(index));
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    },
  );

  it("open on the base chart, then add a range, the other series, a callout and a highlight", () => {
    const annotationTypes = (index: number) =>
      (specAt(index).annotations ?? []).map((annotation) => annotation.type);
    const series = (index: number) => new Set(specAt(index).data.map((row) => row.index)).size;
    expect(specAt(0)).toEqual(storyBaseSpec);
    expect(annotationTypes(1)).toEqual(["range"]);
    expect([series(1), series(2)]).toEqual([1, 4]);
    expect(annotationTypes(3)).toEqual(["range", "text"]);
    expect(specAt(4).encoding.color).toMatchObject({ highlight: ["NASDAQ"] });
  });
});

describe("the plain-words line under each paragraph", () => {
  const line = (index: number) => describeChange(storyBaseSpec, changes, index);

  it("says what each change does to the chart, and nothing for the opening", () => {
    expect(storySteps.map((_, index) => line(index))).toEqual([
      null,
      "In the spec, this step adds a shaded range for 2022.",
      "In the spec, this step adds the NASDAQ, Dow Jones and Russell 2000 lines.",
      "In the spec, this step adds a callout, “Nasdaq, end of 2022: −33%”.",
      "In the spec, this step highlights NASDAQ and dims the rest.",
    ]);
  });

  it("describes only the annotation a step adds, not the ones it restates", () => {
    expect(line(3)).not.toContain("shaded range");
  });

  it("writes highlight sugar as the highlight it sets", () => {
    expect(describeChange(storyBaseSpec, [{ highlight: ["NASDAQ"] }], 0)).toBe(
      "In the spec, this step highlights NASDAQ and dims the rest.",
    );
  });

  it("rejects a step index the story does not have", () => {
    expect(() => line(9)).toThrow("No story step 9: the story has 5 steps.");
  });
});
