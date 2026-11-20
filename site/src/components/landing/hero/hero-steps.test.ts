/**
 * The hero's five steps as a reader meets them: every spec is valid, the chart
 * changes at every step without its y scale moving, and the spec pane's marked
 * lines are what each step really adds and stay put in every later step.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { compileChart, validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { heroSteps } from "../../../landing/hero";
import { toDeskSteps } from "./desk-step";
import { formatSpec } from "./spec-lines";

const SIZE = { width: 520, height: 460 };

/** The engine writes defaults into what it compiles, so compile a copy. */
const compile = (spec: ChartSpec) => compileChart(structuredClone(spec), SIZE);

/** The y values at the top and bottom of the plot, read off two ticks: the scale's domain. */
function yDomain(spec: ChartSpec): [number, number] {
  const layout = compile(spec);
  const [a, b] = layout.axes.y?.ticks ?? [];
  if (!a || !b) throw new Error("The hero chart has fewer than two y ticks.");
  const valueAt = (position: number) =>
    Number(a.value) +
    ((position - a.position) * (Number(b.value) - Number(a.value))) / (b.position - a.position);
  return [valueAt(layout.area.y + layout.area.height), valueAt(layout.area.y)];
}

const paneText = (spec: ChartSpec) =>
  formatSpec(spec)
    .map((line) => line.text)
    .join("\n");

describe("the hero steps", () => {
  it("are five, with unique ids, in the brief's order", () => {
    expect(heroSteps.map((step) => step.id)).toEqual([
      "mark",
      "encoding",
      "chrome",
      "annotation",
      "preset",
    ]);
  });

  it.each(heroSteps.map((step, index) => [index + 1, step] as const))(
    "step %i passes validateSpec",
    (_, step) => {
      expect(validateSpec(structuredClone(step.spec)).errors).toEqual([]);
    },
  );

  it("keeps the y scale's domain at every step", () => {
    const [first, ...rest] = heroSteps.map((step) => yDomain(step.spec));
    for (const domain of rest) {
      expect(domain[0]).toBeCloseTo(first?.[0] ?? Number.NaN, 6);
      expect(domain[1]).toBeCloseTo(first?.[1] ?? Number.NaN, 6);
    }
  });

  it("changes the chart's description or marks at every step", () => {
    const signatures = heroSteps.map((step) => {
      const layout = compile(step.spec);
      return JSON.stringify([
        layout.a11y.altText,
        layout.marks.length,
        layout.annotations.length,
        layout.chrome,
        layout.theme,
      ]);
    });
    expect(new Set(signatures).size).toBe(heroSteps.length);
  });

  it("marks lines every step adds, and they all still show in the finished spec", () => {
    const finished = paneText(heroSteps.at(-1)?.spec ?? ({} as ChartSpec));
    for (const step of heroSteps) {
      expect(step.changed.length, step.id).toBeGreaterThan(0);
      expect(
        step.changed.filter((line) => !finished.includes(line)),
        step.id,
      ).toEqual([]);
    }
  });

  it("adds nothing in the preset step that the spec showed by step 2", () => {
    const throughTwo = paneText(heroSteps[1]?.spec ?? ({} as ChartSpec));
    expect((heroSteps[4]?.changed ?? []).filter((line) => throughTwo.includes(line))).toEqual([]);
  });

  it("gives the island the same marked lines as each step's changed list", () => {
    toDeskSteps(heroSteps).forEach((step, index) => {
      expect(step.lines.filter((line) => line.added).map((line) => line.text)).toEqual(
        heroSteps[index]?.changed,
      );
    });
  });

  it("folds the data rows and keeps every other value in the pane", () => {
    const text = paneText(heroSteps[0]?.spec ?? ({} as ChartSpec));
    expect(text).toContain('"data": [ … 20 rows ],');
    expect(text).not.toContain("United States");
  });
});
