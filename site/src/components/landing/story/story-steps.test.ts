/**
 * The scroll story's steps: each cumulative spec the story can reach passes the
 * engine's validator, the steps are the four the brief names, and each step's
 * margin note shows the field it patches.
 */
import { deepMergeSpec } from "@opendata-ai/openchart-core";
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { storyBaseSpec, storySteps } from "../../../landing/story";
import { changeExcerpt, inlineJson } from "./story-change";

const changes = storySteps.map((step) => step.change);

/** The spec the chart shows at step `index`, merged the way createChartStory merges it. */
const specAt = (index: number) =>
  changes
    .slice(0, index + 1)
    .reduce((spec, change) => deepMergeSpec(spec, change.spec ?? {}), storyBaseSpec);

describe("the story steps", () => {
  it("are four, with unique ids and prose", () => {
    expect(storySteps).toHaveLength(4);
    expect(new Set(storySteps.map((step) => step.id)).size).toBe(4);
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

  it("each change the chart: a range, a revealed series, a callout, a highlight", () => {
    const annotationTypes = (index: number) =>
      (specAt(index).annotations ?? []).map((annotation) => annotation.type);
    const series = (index: number) => new Set(specAt(index).data.map((row) => row.index)).size;
    expect(annotationTypes(0)).toEqual(["range"]);
    expect([series(0), series(1)]).toEqual([1, 4]);
    expect(annotationTypes(2)).toEqual(["range", "text"]);
    expect(specAt(3).encoding.color).toMatchObject({ highlight: ["NASDAQ"] });
  });
});

describe("the margin note for a step", () => {
  it("folds data rows to a count", () => {
    expect(changeExcerpt(changes, 1)).toEqual(['"data": [ … 64 rows ]']);
  });

  it("elides annotations an earlier step already showed", () => {
    const [line] = changeExcerpt(changes, 2);
    expect(line).toMatch(/^"annotations": \[…, \{ "type": "text", "x": "2023-01-01"/);
    expect(line).not.toContain("selloff-2022");
  });

  it("writes highlight sugar as the field it sets", () => {
    expect(changeExcerpt([{ highlight: ["A"] }], 0)).toEqual([
      '"encoding": { "color": { "highlight": ["A"] } }',
    ]);
  });

  it("rejects a step index the story does not have", () => {
    expect(() => changeExcerpt(changes, 9)).toThrow("No story step 9: the story has 4 steps.");
  });

  it("spaces inline JSON the way a person types it", () => {
    expect(inlineJson({ a: [1, "x"], b: { c: null } })).toBe(
      '{ "a": [1, "x"], "b": { "c": null } }',
    );
  });
});
