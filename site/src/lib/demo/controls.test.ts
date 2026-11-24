// @vitest-environment node
/**
 * A demo's reader controls as the build writes them: the bar inside the
 * figure, the embedded states, and the checks that fail a page build.
 */
import { indexTotalReturns } from "@datasets/index-total-returns";
import { usInflation } from "@datasets/us-inflation";
import { type ChartSpec, isRaceSpec, type VizSpec } from "@opendata-ai/openchart-core";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { gdpRace } from "../../demos/change-over-time/race";
import { fixtureBar } from "../../demos/fixtures/bar";
import { editFixture, eventsFixture, statesFixture } from "../../demos/fixtures/controls";
import { fixtureTable } from "../../demos/fixtures/table";
import { basicGraph } from "../../demos/flow/graph";
import { basicSankey } from "../../demos/flow/sankey";
import { basicChoropleth } from "../../demos/maps/choropleth";
import { basicTileMap } from "../../demos/maps/tile-map";
import type { DemoControls, DemoDef } from "../../demos/types";
import { validateDemoControls } from "./controls";
import { demoFigureHtml } from "./figure";
import { InvalidDemoError } from "./validate";

const ALL_CONTROLS: DemoControls = {
  ...statesFixture.controls,
  replay: true,
  eventLog: true,
  exports: ["svg", "png", "csv"],
};

async function render(demo: DemoDef, controls = demo.controls) {
  const html = await demoFigureHtml({
    id: demo.id,
    spec: demo.spec,
    title: demo.title,
    source: demo.source,
    height: 320,
    entrance: false,
    tabs: false,
    static: false,
    mount: demo.mount,
    controls,
  });
  const doc = new new Window().DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const element = doc.querySelector("div.demo");
  if (!element) throw new Error("demoFigureHtml returned no demo element");
  return element;
}

/** Trimmed text of a happy-dom node, whose types differ from the DOM library's. */
const textOf = (node: { textContent: string | null } | null | undefined) =>
  node?.textContent?.trim() ?? "";

describe("the controls bar", () => {
  it("sits in the figure between the stage and the caption", async () => {
    const figure = (await render(statesFixture, ALL_CONTROLS)).querySelector("figure");
    expect([...(figure?.children ?? [])].map((child) => child.className)).toEqual([
      "demo-stage",
      "demo-controls",
      "figure-caption",
    ]);
  });

  it("labels the state buttons as one group, the first pressed, each holding its index", async () => {
    const demo = await render(statesFixture, ALL_CONTROLS);
    const group = demo.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe("Chart states");
    const buttons = [...(group?.querySelectorAll("button") ?? [])];
    expect(
      buttons.map((button) => [
        textOf(button),
        button.getAttribute("aria-pressed"),
        button.getAttribute("data-demo-state"),
      ]),
    ).toEqual([
      ["2019 to 2024", "true", "0"],
      ["2019 to 2021", "false", "1"],
    ]);
  });

  it("names Replay and the downloads in the order given, and holds an empty event log", async () => {
    const demo = await render(statesFixture, ALL_CONTROLS);
    const actions = [...demo.querySelectorAll(".demo-controls button:not([data-demo-state])")];
    expect(actions.map(textOf)).toEqual(["Replay", "Download SVG", "Download PNG", "Download CSV"]);
    expect(actions.slice(1).map((button) => button.getAttribute("data-demo-export"))).toEqual([
      "svg",
      "png",
      "csv",
    ]);
    const log = demo.querySelector("ol[data-demo-events]");
    expect(log?.children).toHaveLength(0);
  });

  it("ships every control hidden, so no control is dead without JavaScript", async () => {
    const demo = await render(statesFixture, ALL_CONTROLS);
    const controls = [...demo.querySelectorAll(".demo-controls button, [data-demo-events]")];
    expect(controls).toHaveLength(7);
    expect(controls.filter((control) => control.closest("[hidden]") === null)).toEqual([]);
  });

  it("writes only the controls a demo asks for", async () => {
    const demo = await render(eventsFixture);
    expect(demo.querySelectorAll(".demo-controls button")).toHaveLength(0);
    expect(demo.querySelector("[data-demo-events]")).not.toBeNull();
    expect(demo.querySelector("[data-demo-states]")).toBeNull();
  });

  it("writes a bar for edit mode alone, whose edits are announced", async () => {
    const demo = await render({ ...editFixture, controls: undefined });
    const bar = demo.querySelector("[data-demo-controls]");
    expect(bar?.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(bar?.querySelector("button, [data-demo-events]")).toBeNull();
  });

  it("writes no bar for a demo without controls", async () => {
    const demo = await render({ ...eventsFixture, controls: undefined });
    expect(demo.querySelector("[data-demo-controls]")).toBeNull();
  });
});

describe("the embedded states", () => {
  const statesScript = async (demo: DemoDef) =>
    textOf((await render(demo)).querySelector("script[data-demo-states]"));
  const withState = (spec: ChartSpec): DemoDef => ({
    ...statesFixture,
    controls: { states: { initialLabel: "Line", others: [{ label: "Other", spec }] } },
  });
  const ownSpec = statesFixture.spec as ChartSpec;
  const firstDate = usInflation.data[0]?.date ?? "";

  it("adds no data bytes for a state that repeats the demo's data", async () => {
    const script = await statesScript(withState({ ...ownSpec, mark: "area" } as ChartSpec));
    expect(script).toContain('"area"');
    expect(script).not.toContain(firstDate);
  });

  it("moves a state's large distinct data into a shared block the state references", async () => {
    // The landing story's rows with a quarter label each: past the size worth sharing.
    const rows = indexTotalReturns.data.map((row) => ({
      ...row,
      quarter: `${row.date.slice(0, 4)} Q${Math.ceil(Number(row.date.slice(5, 7)) / 3)}`,
    }));
    const state = { ...ownSpec, data: rows } as ChartSpec;
    const html = await demoFigureHtml({
      id: statesFixture.id,
      spec: ownSpec,
      title: statesFixture.title,
      source: statesFixture.source,
      height: 320,
      entrance: false,
      tabs: false,
      static: false,
      pageShared: new Set(),
      controls: { states: { initialLabel: "Line", others: [{ label: "Indexes", spec: state }] } },
    });
    const doc = new new Window().DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const blocks = [...doc.querySelectorAll("script[data-demo-shared]")];
    expect(blocks).toHaveLength(1);
    expect(JSON.parse(blocks[0]?.textContent ?? "null")).toEqual(rows);
    const [embedded] = JSON.parse(textOf(doc.querySelector("script[data-demo-states]")));
    expect(embedded.spec.data).toBeNull();
    expect(embedded.shared).toEqual([
      { path: ["data"], hash: blocks[0]?.getAttribute("data-demo-shared") },
    ]);
  });

  it("carries the rows of a state whose data differs", async () => {
    const fewer = { ...ownSpec, data: ownSpec.data.slice(0, 4) } as ChartSpec;
    expect(await statesScript(withState(fewer))).toContain(firstDate);
  });
});

describe("validateDemoControls", () => {
  it("throws InvalidDemoError naming the demo and the state whose spec fails validation", () => {
    const broken = { mark: "line", data: [], encoding: {} } as unknown as VizSpec;
    const demo: DemoDef = {
      ...statesFixture,
      controls: {
        states: { initialLabel: "All", others: [{ label: "Broken view", spec: broken }] },
      },
    };
    expect(() => validateDemoControls(demo)).toThrow(InvalidDemoError);
    expect(() => validateDemoControls(demo)).toThrow(/fixtures\/states.*Broken view/);
  });

  it.each([
    ["table", fixtureTable],
    ["map", basicChoropleth],
    ["graph", basicGraph],
    ["sankey", basicSankey],
    ["tile map", basicTileMap],
  ])("throws InvalidDemoError for controls on a %s spec", (_kind, demo) => {
    const withControls = { ...demo, controls: { replay: true } };
    expect(() => validateDemoControls(withControls)).toThrow(InvalidDemoError);
    expect(() => validateDemoControls(withControls)).toThrow(new RegExp(demo.id));
  });

  it("throws for controls on a bar list spec", () => {
    const barList = { type: "barlist", data: [{ label: "A", value: 1 }] } as unknown as VizSpec;
    const demo: DemoDef = { ...eventsFixture, spec: barList };
    expect(() => validateDemoControls(demo)).toThrow(/chart and layer specs only/);
  });

  it("throws for edit mode without other controls on a spec that is not a chart", () => {
    const demo: DemoDef = { ...fixtureTable, mount: { interaction: "edit" } };
    expect(() => validateDemoControls(demo)).toThrow(InvalidDemoError);
    expect(() => validateDemoControls({ ...demo, mount: undefined })).not.toThrow();
  });

  it("accepts controls on a chart whose states are valid", () => {
    expect(() => validateDemoControls(statesFixture)).not.toThrow();
  });

  it("accepts race mark states", () => {
    expect(() => validateDemoControls(gdpRace)).not.toThrow();
  });

  it.each([
    { controls: { replay: true } },
    { controls: { eventLog: true } },
    { controls: { exports: ["svg"] } },
    { mount: { interaction: "edit" } },
    { mount: { renderer: "canvas" } },
  ] satisfies Array<Partial<DemoDef>>)(
    "rejects chart controls or mount options on a race (%j)",
    (overrides) => {
      expect(() => validateDemoControls({ ...gdpRace, ...overrides })).toThrow(
        /state buttons only/,
      );
    },
  );

  it.each([
    [gdpRace, fixtureBar],
    [fixtureBar, gdpRace],
    [fixtureBar, fixtureTable],
  ])("rejects a switch between incompatible demo types", (own, other) => {
    const controls = {
      states: { initialLabel: own.title, others: [{ label: "Other mark", spec: other.spec }] },
    };
    expect(() => validateDemoControls({ ...own, controls })).toThrow(
      /Other mark.*\n.*Use race specs/,
    );
  });

  it.each([
    { years: [2000, 2000, 2001], reason: /2 rows have country = 'Canada' and year = 2000/ },
    { years: [2000], reason: /Supply at least two periods/ },
  ])("fails the build for invalid race state data in $years", ({ years, reason }) => {
    const { spec } = gdpRace;
    if (!isRaceSpec(spec)) throw new Error("Expected a race demo.");
    const broken = { ...spec, data: years.map((year) => ({ year, country: "Canada", gdp: 1 })) };
    const controls = {
      states: { initialLabel: "Bar", others: [{ label: "Broken rows", spec: broken }] },
    };
    const validate = () => validateDemoControls({ ...gdpRace, controls });
    expect(validate).toThrow(/state "Broken rows"/);
    expect(validate).toThrow(reason);
  });
});
