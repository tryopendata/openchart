/**
 * Reader controls on live demos: real figures from the build, mounted by the
 * page script (demos.ts) with the real library in happy-dom. Only the browser
 * APIs the site doesn't own stand in: an IntersectionObserver whose view the
 * test sets, and the anchor click and blob URL a download goes through.
 */

import { indexTotalReturns } from "@datasets/index-total-returns";
import type { ChartSpec, EditTransaction } from "@opendata-ai/openchart-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  editFixture,
  eventsFixture,
  exportFixture,
  statesFixture,
} from "../demos/fixtures/controls";
import type { DemoDef } from "../demos/types";
import { demoFigureHtml } from "../lib/demo/figure";
import { type LiveHandle, wireDemoControls } from "./demo-controls";
import { startDemos } from "./demos";

/** Stands in for IntersectionObserver: every stage is in view unless a test takes it out. */
class Viewport {
  static observers: Viewport[] = [];
  static outOfView = new Set<Element>();
  private readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    Viewport.observers.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
    queueMicrotask(() => this.report(target));
  }

  unobserve() {}
  disconnect() {}

  private report(target: Element) {
    const entry = { target, isIntersecting: !Viewport.outOfView.has(target) };
    this.callback([entry as unknown as IntersectionObserverEntry], this as never);
  }

  /** Scrolls a stage into or out of view, as the reader would. */
  static show(target: Element, inView: boolean) {
    if (inView) Viewport.outOfView.delete(target);
    else Viewport.outOfView.add(target);
    for (const observer of Viewport.observers) {
      if (observer.targets.has(target)) observer.report(target);
    }
  }
}

type FigureOptions = { static?: boolean; pageShared?: Set<string> };

const figureHtml = (demo: DemoDef, options: FigureOptions = {}) =>
  demoFigureHtml({
    ...demo,
    height: 320,
    entrance: false,
    tabs: false,
    static: options.static ?? false,
    pageShared: options.pageShared,
  });

/** Puts the demos on the page, starts the page script, and waits until each stage is live. */
async function livePage(demos: DemoDef[], options: FigureOptions = {}) {
  document.body.innerHTML = (await Promise.all(demos.map((d) => figureHtml(d, options)))).join("");
  startDemos(document);
  await vi.waitFor(() =>
    expect(document.querySelectorAll("[data-demo-live]")).toHaveLength(demos.length),
  );
}

const demoElement = (id: string) => {
  const element = document.querySelector<HTMLElement>(`[data-demo="${id}"]`);
  if (!element) throw new Error(`No demo ${id} on the page`);
  return element;
};

const stageOf = (id: string) => {
  const stage = demoElement(id).querySelector("[data-demo-stage]");
  if (!stage) throw new Error(`No stage in ${id}`);
  return stage;
};

/** The live chart's accessible name, which states its title and how many data points it draws. */
const chartLabel = (id: string) =>
  demoElement(id).querySelector(".demo-live svg.oc-chart")?.getAttribute("aria-label") ?? "";

const pointsIn = (label: string) => Number(/\((\d+) data points\)/.exec(label)?.[1]);

const button = (id: string, name: string) => {
  const found = [...demoElement(id).querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === name,
  );
  if (!found) throw new Error(`No ${name} button in ${id}`);
  return found;
};

const statusOf = (id: string) =>
  demoElement(id).querySelector("[data-demo-controls-status]")?.textContent;

const logEntries = (id: string) =>
  [...demoElement(id).querySelectorAll("[data-demo-events] li")].map((li) => li.textContent);

/** A `#rrggbb` color's mean channel value, 0 for black to 1 for white; NaN when it isn't one. */
function brightness(hex: string): number {
  const channels = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)?.slice(1) ?? [];
  if (channels.length !== 3) return Number.NaN;
  return channels.reduce((sum, channel) => sum + Number.parseInt(channel, 16), 0) / (3 * 255);
}

const STATES = statesFixture.id;
const allRows = (statesFixture.spec as ChartSpec).data.length;
const secondState = statesFixture.controls?.states?.others[0];
if (!secondState) throw new Error("fixtures/states needs a second state");
const throughEnd2021 = (secondState.spec as ChartSpec).data.length;

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", Viewport);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Viewport.observers = [];
  Viewport.outOfView.clear();
  document.documentElement.className = "";
  document.body.innerHTML = "";
});

describe("state buttons", () => {
  it("show once the stage is live, with the demo's own state pressed", async () => {
    await livePage([statesFixture]);
    const group = demoElement(STATES).querySelector<HTMLElement>('[role="group"]');
    expect(group?.hidden).toBe(false);
    expect(button(STATES, "2019 to 2024").getAttribute("aria-pressed")).toBe("true");
    expect(pointsIn(chartLabel(STATES))).toBe(allRows);
  });

  it("move the live chart to the chosen state, press its button and announce it", async () => {
    await livePage([statesFixture]);
    button(STATES, "2019 to 2021").click();
    expect(pointsIn(chartLabel(STATES))).toBe(throughEnd2021);
    expect(button(STATES, "2019 to 2021").getAttribute("aria-pressed")).toBe("true");
    expect(button(STATES, "2019 to 2024").getAttribute("aria-pressed")).toBe("false");
    await vi.waitFor(() => expect(statusOf(STATES)).toBe("Showing: 2019 to 2021"));
    // No attribution link inside the chart after an update either.
    expect(demoElement(STATES).querySelector(".demo-live a")).toBeNull();

    button(STATES, "2019 to 2024").click();
    expect(pointsIn(chartLabel(STATES))).toBe(allRows);
    await vi.waitFor(() => expect(statusOf(STATES)).toBe("Showing: 2019 to 2024"));
  });

  it("announce the same state again when it is chosen twice", async () => {
    await livePage([statesFixture]);
    button(STATES, "2019 to 2021").click();
    await vi.waitFor(() => expect(statusOf(STATES)).toBe("Showing: 2019 to 2021"));
    button(STATES, "2019 to 2021").click();
    // Cleared at once, then written again on the next frame, so the region changes.
    expect(statusOf(STATES)).toBe("");
    await vi.waitFor(() => expect(statusOf(STATES)).toBe("Showing: 2019 to 2021"));
  });

  it("keep the chosen state when a theme change remounts the chart", async () => {
    await livePage([statesFixture]);
    button(STATES, "2019 to 2021").click();
    const before = demoElement(STATES).querySelector(".demo-live");
    document.documentElement.classList.add("dark");
    await vi.waitFor(() =>
      expect(demoElement(STATES).querySelector(".demo-live")).not.toBe(before),
    );
    expect(demoElement(STATES).querySelector(".demo-live svg")?.getAttribute("data-theme")).toBe(
      "dark",
    );
    expect(pointsIn(chartLabel(STATES))).toBe(throughEnd2021);
    expect(button(STATES, "2019 to 2021").getAttribute("aria-pressed")).toBe("true");
  });

  it("keep the chosen state when the chart is evicted and mounted again", async () => {
    // Seven demos with static SVGs: one more than the page keeps live.
    const demos = Array.from({ length: 7 }, (_, index) => ({
      ...statesFixture,
      id: `fixtures/states-${index}`,
    }));
    const [first, ...rest] = demos.map((demo) => demo.id);
    if (!first) throw new Error("no demos");
    document.body.innerHTML = (
      await Promise.all(demos.map((demo) => figureHtml(demo, { static: true })))
    ).join("");
    for (const id of rest) Viewport.outOfView.add(stageOf(id));
    startDemos(document);
    await vi.waitFor(() => expect(stageOf(first).hasAttribute("data-demo-live")).toBe(true));
    button(first, "2019 to 2021").click();

    // The reader scrolls past the first demo to the other six, which evicts it.
    Viewport.show(stageOf(first), false);
    for (const id of rest) Viewport.show(stageOf(id), true);
    await vi.waitFor(() => expect(stageOf(first).hasAttribute("data-demo-live")).toBe(false));

    Viewport.show(stageOf(first), true);
    await vi.waitFor(() => expect(stageOf(first).hasAttribute("data-demo-live")).toBe(true));
    expect(pointsIn(chartLabel(first))).toBe(throughEnd2021);
    expect(button(first, "2019 to 2021").getAttribute("aria-pressed")).toBe("true");
  });

  it("draw a state whose large data comes from the page's shared value block", async () => {
    // The landing story's rows, each with a quarter label for the tooltip: too large to embed twice.
    const rows = indexTotalReturns.data.map((row) => ({
      ...row,
      quarter: `${row.date.slice(0, 4)} Q${Math.ceil(Number(row.date.slice(5, 7)) / 3)}`,
    }));
    const base: ChartSpec = {
      mark: "line",
      data: rows.filter((row) => row.index === "S&P 500"),
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "totalReturn", type: "quantitative" },
        color: { field: "index", type: "nominal" },
      },
    };
    const demo: DemoDef = {
      ...statesFixture,
      spec: base,
      controls: {
        states: {
          initialLabel: "S&P 500",
          others: [{ label: "All four", spec: { ...base, data: rows } }],
        },
      },
    };
    await livePage([demo], { pageShared: new Set() });
    expect(document.querySelectorAll("script[data-demo-shared]")).toHaveLength(1);
    button(STATES, "All four").click();
    expect(pointsIn(chartLabel(STATES))).toBe(rows.length);
  });
});

describe("Replay", () => {
  const replayable: DemoDef = {
    ...statesFixture,
    controls: { ...statesFixture.controls, replay: true },
  };

  it("mounts the chart afresh in its current state", async () => {
    await livePage([replayable]);
    button(STATES, "2019 to 2021").click();
    const before = demoElement(STATES).querySelector(".demo-live");
    button(STATES, "Replay").click();
    const after = demoElement(STATES).querySelector(".demo-live");
    expect(after).not.toBe(before);
    expect(demoElement(STATES).querySelectorAll(".demo-live")).toHaveLength(1);
    expect(stageOf(STATES).hasAttribute("data-demo-live")).toBe(true);
    expect(pointsIn(chartLabel(STATES))).toBe(throughEnd2021);
  });
});

describe("controls that fail to set up", () => {
  it("leave the bar hidden, report the demo id and still mount the chart", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    document.body.innerHTML = await figureHtml(statesFixture);
    const states = document.querySelector("script[data-demo-states]");
    if (!states) throw new Error("no states script");
    states.textContent = "{ not JSON";
    startDemos(document);
    await vi.waitFor(() => expect(stageOf(STATES).hasAttribute("data-demo-live")).toBe(true));
    expect(demoElement(STATES).querySelector<HTMLElement>("[data-demo-controls]")?.hidden).toBe(
      true,
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Demo "fixtures/states"'),
      expect.any(SyntaxError),
    );
  });
});

describe("the event log", () => {
  const EVENTS = eventsFixture.id;
  const bars = () => [...demoElement(EVENTS).querySelectorAll(".demo-live [data-mark-id]")];

  it("shows once the stage is live and lists a click on a mark, naming its row", async () => {
    await livePage([eventsFixture]);
    expect(demoElement(EVENTS).querySelector<HTMLElement>("[data-demo-events]")?.hidden).toBe(
      false,
    );
    expect(logEntries(EVENTS)).toEqual([]);
    bars()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(logEntries(EVENTS)).toEqual([expect.stringMatching(/^onMarkClick: country India, /)]);
  });

  it("keeps the newest eight entries, newest first", async () => {
    await livePage([eventsFixture]);
    const marks = bars();
    expect(marks).toHaveLength(10);
    for (const mark of marks) mark.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const entries = logEntries(EVENTS);
    expect(entries).toHaveLength(8);
    const countries = entries.map((entry) => /country ([^,]+),/.exec(entry ?? "")?.[1]);
    const clicked = marks.map((mark) => mark.getAttribute("aria-label") ?? "");
    // Newest first: the last bar clicked heads the log, and the first two clicked have gone.
    expect(clicked[9]).toContain(countries[0]);
    expect(clicked[2]).toContain(countries[7]);
  });

  it("mounts in read mode, so its selection handlers never turn selection on", async () => {
    await livePage([eventsFixture, { ...editFixture, controls: { eventLog: true } }]);
    const title = (id: string) =>
      demoElement(id).querySelector<SVGElement>(
        ".demo-live .oc-title, .demo-live [data-chrome-key='title']",
      );
    for (const id of [EVENTS, editFixture.id]) {
      expect(title(id), id).not.toBeNull();
      title(id)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    expect(logEntries(EVENTS)).toEqual([]);
    expect(logEntries(editFixture.id)).toEqual(["onSelect: /chrome/title"]);
  });
});

describe("edits", () => {
  /** A handle around an in-memory spec: what the controls ask demos.ts to draw. */
  function specHandle(spec: ChartSpec) {
    const handle = {
      current: spec,
      exportFile: () => Promise.reject(new Error("not used")),
      spec: () => handle.current,
      update: (next: ChartSpec) => {
        handle.current = next;
      },
      remount: () => {},
    };
    return handle;
  }

  const offsetEdit = (text: string): EditTransaction => ({
    ops: [
      {
        op: "set",
        path: "/annotations/0/offset",
        value: { dx: 12, dy: -4 },
        expect: { type: "text", text },
      },
    ],
  });

  async function wiredEditDemo() {
    document.body.innerHTML = await figureHtml(editFixture);
    const handle = specHandle(editFixture.spec as ChartSpec);
    const wired = wireDemoControls(demoElement(editFixture.id), handle as unknown as LiveHandle);
    return { handle, wired };
  }

  it("mount in edit mode and apply each edit to the current spec, then log and announce it", async () => {
    const { handle, wired } = await wiredEditDemo();
    expect(wired.interaction).toBe("edit");
    wired.handlers.onEdit?.(offsetEdit("Peak: 8.5%"));
    expect(handle.current.annotations?.[0]).toMatchObject({ offset: { dx: 12, dy: -4 } });
    expect(logEntries(editFixture.id)).toEqual([
      'onEdit: set /annotations/0/offset {"dx":12,"dy":-4}',
    ]);
    await vi.waitFor(() => expect(statusOf(editFixture.id)).toBe("Edit applied."));
  });

  it("leave the spec alone and log Edit rejected for a transaction that does not apply", async () => {
    const { handle, wired } = await wiredEditDemo();
    wired.handlers.onEdit?.(offsetEdit("Some other note"));
    expect(handle.current).toBe(editFixture.spec);
    expect(logEntries(editFixture.id)).toEqual([expect.stringMatching(/^Edit rejected: /)]);
    await vi.waitFor(() => expect(statusOf(editFixture.id)).toBe("Edit rejected."));
  });
});

describe("downloads", () => {
  const EXPORT = exportFixture.id;

  /** Captures what each download link would save, instead of navigating. */
  function captureDownloads() {
    const files = new Map<string, Blob>();
    const saved: { name: string; file: Blob | undefined }[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((file) => {
      const url = `blob:test/${files.size}`;
      files.set(url, file as Blob);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ name: this.download, file: files.get(this.href) });
    });
    return saved;
  }

  it("save the chart as SVG under the demo id", async () => {
    await livePage([exportFixture]);
    const saved = captureDownloads();
    button(EXPORT, "Download SVG").click();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toBe("fixtures-export.svg");
    expect(saved[0]?.file?.type).toBe("image/svg+xml");
    expect(await saved[0]?.file?.text()).toMatch(/^<svg/);
  });

  it("save a light chart on opaque white paper when the site is dark", async () => {
    document.documentElement.classList.add("dark");
    await livePage([exportFixture]);
    expect(demoElement(EXPORT).querySelector(".demo-live svg")?.getAttribute("data-theme")).toBe(
      "dark",
    );
    const saved = captureDownloads();
    button(EXPORT, "Download SVG").click();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    const svg = new DOMParser().parseFromString(
      (await saved[0]?.file?.text()) ?? "",
      "image/svg+xml",
    );
    expect(svg.documentElement.getAttribute("data-theme")).toBe("light");
    expect(svg.querySelector("svg > rect")?.getAttribute("fill")).toBe("#ffffff");
    const title = [...svg.querySelectorAll("text")].find((text) =>
      text.textContent?.startsWith("India and China"),
    );
    // Dark text for the white paper, where the live dark chart draws near-white text.
    const fill = /fill:\s*(#[0-9a-f]{6})/i.exec(title?.getAttribute("style") ?? "")?.[1] ?? "";
    expect(brightness(fill), fill).toBeLessThan(0.2);
    // Nothing is left behind on the page.
    expect(document.querySelectorAll(".oc-chart")).toHaveLength(1);
  });

  it("save the chart's rows as CSV with a header row", async () => {
    await livePage([exportFixture]);
    const saved = captureDownloads();
    button(EXPORT, "Download CSV").click();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toBe("fixtures-export.csv");
    const lines = (await saved[0]?.file?.text())?.trim().split("\n") ?? [];
    expect(lines[0]).toBe("country,population");
    expect(lines).toHaveLength(11);
  });

  it("save once when the button is pressed twice before the first export finishes", async () => {
    await livePage([exportFixture]);
    const saved = captureDownloads();
    const svgButton = button(EXPORT, "Download SVG");
    svgButton.click();
    svgButton.click();
    await vi.waitFor(() => expect(svgButton.disabled).toBe(false));
    expect(saved).toHaveLength(1);
  });

  it("say Export failed for two seconds, announce it and report the demo id when the export fails", async () => {
    document.body.innerHTML = await figureHtml(exportFixture);
    const handle = {
      exportFile: () => Promise.reject(new Error("The chart could not be drawn.")),
    } as unknown as LiveHandle;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    wireDemoControls(demoElement(EXPORT), handle).reveal();
    const svgButton = button(EXPORT, "Download SVG");
    svgButton.click();
    await vi.waitFor(() => expect(svgButton.textContent).toBe("Export failed"));
    await vi.waitFor(() =>
      expect(statusOf(EXPORT)).toBe("Export failed: the SVG file could not be made."),
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Demo "fixtures/export"'),
      expect.any(Error),
    );
    vi.useFakeTimers();
    svgButton.click();
    await vi.waitFor(() => expect(svgButton.disabled).toBe(false));
    vi.advanceTimersByTime(2000);
    expect(svgButton.textContent).toBe("Download SVG");
  });
});
