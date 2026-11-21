/**
 * The hero's five steps as a reader meets them: every spec is valid, the chart
 * changes at every step without its value scale moving once the encoding step
 * has set it, the spec pane's marked lines are what each step really adds and
 * stay put in every later step, and the preset the last step adds is what the
 * chart shows under the site's mount theme.
 */
import { broadsheet, type ChartSpec } from "@opendata-ai/openchart-core";
import { compileChart, validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { heroFolds, heroSteps } from "../../../landing/hero";
import { heroChartTheme } from "../../../landing/hero-theme";
import { formatSpec, lineKey } from "../../../landing/spec-lines";
import { chartTheme } from "../../../lib/demo/chart-theme";

const SIZE = { width: 620, height: 540 };

/** The engine writes defaults into what it compiles, so compile a copy. */
const compile = (spec: ChartSpec, theme = heroChartTheme) =>
  compileChart(structuredClone(spec), { ...SIZE, theme });

/** The x values at the plot's left and right edges, read off two ticks: the value scale's domain. */
function xDomain(spec: ChartSpec): [number, number] {
  const layout = compile(spec);
  const [a, b] = layout.axes.x?.ticks ?? [];
  if (!a || !b) throw new Error("The hero chart has fewer than two x ticks.");
  const valueAt = (position: number) =>
    Number(a.value) +
    ((position - a.position) * (Number(b.value) - Number(a.value))) / (b.position - a.position);
  return [valueAt(layout.area.x), valueAt(layout.area.x + layout.area.width)];
}

const stepAt = (index: number) => {
  const step = heroSteps[index];
  if (!step) throw new Error(`The hero has no step ${index + 1}.`);
  return step;
};

/** Each line the pane shows for a spec, as depth and text. */
const paneLines = (spec: ChartSpec) => formatSpec(spec, heroFolds).map(lineKey);

/** A step's changed lines matched against a pane: present at some depth, ignoring a gained comma. */
const missingFrom = (changed: string[], spec: ChartSpec) => {
  const lines = formatSpec(spec, heroFolds).map((line) => line.text.replace(/,$/, ""));
  return changed.filter((line) => !lines.includes(line.replace(/,$/, "")));
};

describe("the hero steps", () => {
  it("are five, with unique ids, in build order", () => {
    expect(heroSteps.map((step) => step.id)).toEqual([
      "plot",
      "headline",
      "axis",
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

  it("draws every step on the finished chart's value scale, 65 to 90 years", () => {
    for (const step of heroSteps) {
      const [low, high] = xDomain(step.spec);
      expect(low, step.id).toBeCloseTo(65, 6);
      expect(high, step.id).toBeCloseTo(90, 6);
    }
  });

  it("orders the rows by the gap between the sexes, Russia's at the top, in every step", () => {
    for (const step of heroSteps) {
      const rows = compile(step.spec)
        .axes.y?.ticks.slice()
        .sort((a, b) => a.position - b.position)
        .map((tick) => String(tick.value));
      expect(rows?.[0], step.id).toBe("Russia");
      expect(rows?.at(-1), step.id).toBe("India");
    }
  });

  it("changes the chart's description from step 1 to step 2, and the chart at every step", () => {
    const layouts = heroSteps.map((step) => compile(step.spec));
    expect(layouts[1]?.a11y.altText).not.toBe(layouts[0]?.a11y.altText);
    const signatures = layouts.map((layout) =>
      JSON.stringify([
        layout.a11y.altText,
        layout.axes.x?.label,
        layout.annotations.length,
        layout.chrome,
        layout.theme,
      ]),
    );
    expect(new Set(signatures).size).toBe(heroSteps.length);
  });

  it("marks lines at every step, and each still shows in the finished spec at its depth", () => {
    const finished = new Set(paneLines(stepAt(4).spec).map((key) => key.replace(/,$/, "")));
    for (const [index, step] of heroSteps.entries()) {
      expect(step.changed.length, step.id).toBeGreaterThan(0);
      const marked = formatSpec(step.spec, heroFolds)
        .filter((line) => step.changed.includes(line.text))
        .map((line) => lineKey(line).replace(/,$/, ""));
      expect(marked.length, `step ${index + 1} finds its changed lines`).toBeGreaterThanOrEqual(
        step.changed.length,
      );
      expect(
        marked.filter((key) => !finished.has(key)),
        step.id,
      ).toEqual([]);
    }
  });

  it("teases each step with one of the lines it adds", () => {
    expect(
      heroSteps.filter((step) => !step.changed.includes(step.teaser)).map((s) => s.id),
    ).toEqual([]);
  });

  it("folds the preset to one added line, which no earlier step shows", () => {
    expect(stepAt(4).changed).toEqual(['"theme": { … broadsheet preset }']);
    expect(missingFrom(stepAt(4).changed, stepAt(1).spec)).toEqual(stepAt(4).changed);
  });

  it("keeps the preset's full lines behind the fold", () => {
    const fold = formatSpec(stepAt(4).spec, heroFolds).find((line) => line.folded);
    const hidden = (fold?.folded ?? []).map((line) => line.text).join("\n");
    expect(hidden).toContain('"theme": {');
    expect(hidden).toContain('"background": { "light": "#fffdf9", "dark": "#12181f" },');
    expect(hidden).toContain(`"borderRadius": ${broadsheet.borderRadius}`);
  });

  it("folds the data rows", () => {
    const text = paneLines(stepAt(0).spec).join("\n");
    expect(text).toContain('1:"data": [ … 24 rows ],');
    // A data value (Japan's figure for men) is folded away, not printed.
    expect(text).not.toContain("81.9");
  });

  it("shows the broadsheet paper under the hero's mount theme, which the site's usual theme would hide", () => {
    const paper = { light: "#fffdf9" };
    expect(compile(stepAt(4).spec).theme.colors.background).toBe(paper.light);
    expect(compile(stepAt(4).spec, chartTheme(false)).theme.colors.background).not.toBe(
      paper.light,
    );
  });
});
