/**
 * Reader controls on live demos: real figures from the build, mounted by the
 * page script (demos.ts) with the real library in happy-dom. Only the browser
 * APIs the site doesn't own stand in: an IntersectionObserver that reports
 * every stage in view, and the anchor click and blob URL a download goes through.
 */
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

/** Reports every observed stage in view, as a reader scrolled to it would. */
class EverythingInView {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback(
        [{ target, isIntersecting: true } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }
  unobserve() {}
  disconnect() {}
}

const figureHtml = (demo: DemoDef) =>
  demoFigureHtml({
    ...demo,
    height: 320,
    entrance: false,
    tabs: false,
    static: false,
  });

/** Puts the demos on the page, starts the page script, and waits until each stage is live. */
async function livePage(...demos: DemoDef[]) {
  document.body.innerHTML = (await Promise.all(demos.map(figureHtml))).join("");
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

const STATES = statesFixture.id;
const allRows = (statesFixture.spec as ChartSpec).data.length;
const secondState = statesFixture.controls?.states?.others[0];
if (!secondState) throw new Error("fixtures/states needs a second state");
const throughEnd2021 = (secondState.spec as ChartSpec).data.length;

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", EverythingInView);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.className = "";
  document.body.innerHTML = "";
});

describe("state buttons", () => {
  it("show once the stage is live, with the demo's own state pressed", async () => {
    await livePage(statesFixture);
    const group = demoElement(STATES).querySelector<HTMLElement>('[role="group"]');
    expect(group?.hidden).toBe(false);
    expect(button(STATES, "2019 to 2024").getAttribute("aria-pressed")).toBe("true");
    expect(pointsIn(chartLabel(STATES))).toBe(allRows);
  });

  it("move the live chart to the chosen state, press its button and announce it", async () => {
    await livePage(statesFixture);
    button(STATES, "2019 to 2021").click();
    expect(pointsIn(chartLabel(STATES))).toBe(throughEnd2021);
    expect(button(STATES, "2019 to 2021").getAttribute("aria-pressed")).toBe("true");
    expect(button(STATES, "2019 to 2024").getAttribute("aria-pressed")).toBe("false");
    expect(statusOf(STATES)).toBe("Showing: 2019 to 2021");
    // No attribution link inside the chart after an update either.
    expect(demoElement(STATES).querySelector(".demo-live a")).toBeNull();

    button(STATES, "2019 to 2024").click();
    expect(pointsIn(chartLabel(STATES))).toBe(allRows);
    expect(statusOf(STATES)).toBe("Showing: 2019 to 2024");
  });

  it("keep the chosen state when a theme change remounts the chart", async () => {
    await livePage(statesFixture);
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
});

describe("Replay", () => {
  const replayable: DemoDef = {
    ...statesFixture,
    controls: { ...statesFixture.controls, replay: true },
  };

  it("mounts the chart afresh in its current state", async () => {
    await livePage(replayable);
    button(STATES, "2019 to 2021").click();
    const before = demoElement(STATES).querySelector(".demo-live");
    button(STATES, "Replay").click();
    const after = demoElement(STATES).querySelector(".demo-live");
    expect(after).not.toBe(before);
    expect(demoElement(STATES).querySelectorAll(".demo-live")).toHaveLength(1);
    expect(
      demoElement(STATES).querySelector("[data-demo-stage]")?.hasAttribute("data-demo-live"),
    ).toBe(true);
    expect(pointsIn(chartLabel(STATES))).toBe(throughEnd2021);
  });
});

describe("the event log", () => {
  const EVENTS = eventsFixture.id;
  const bars = () => [...demoElement(EVENTS).querySelectorAll(".demo-live [data-mark-id]")];

  it("shows once the stage is live and lists a click on a mark, naming its row", async () => {
    await livePage(eventsFixture);
    expect(demoElement(EVENTS).querySelector<HTMLElement>("[data-demo-events]")?.hidden).toBe(
      false,
    );
    expect(logEntries(EVENTS)).toEqual([]);
    bars()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(logEntries(EVENTS)).toEqual([expect.stringMatching(/^onMarkClick: country India, /)]);
  });

  it("keeps the newest eight entries, newest first", async () => {
    await livePage(eventsFixture);
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
    await livePage(eventsFixture, { ...editFixture, controls: { eventLog: true } });
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
      instance: () => null,
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
    expect(statusOf(editFixture.id)).toBe("Edit applied.");
  });

  it("leave the spec alone and log Edit rejected for a transaction that does not apply", async () => {
    const { handle, wired } = await wiredEditDemo();
    wired.handlers.onEdit?.(offsetEdit("Some other note"));
    expect(handle.current).toBe(editFixture.spec);
    expect(logEntries(editFixture.id)).toEqual([expect.stringMatching(/^Edit rejected: /)]);
    expect(statusOf(editFixture.id)).toBe("Edit rejected.");
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

  it("save the live chart as SVG under the demo id", async () => {
    await livePage(exportFixture);
    const saved = captureDownloads();
    button(EXPORT, "Download SVG").click();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toBe("fixtures-export.svg");
    expect(saved[0]?.file?.type).toBe("image/svg+xml");
    expect(await saved[0]?.file?.text()).toMatch(/^<svg/);
  });

  it("save the chart's rows as CSV with a header row", async () => {
    await livePage(exportFixture);
    const saved = captureDownloads();
    button(EXPORT, "Download CSV").click();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toBe("fixtures-export.csv");
    const lines = (await saved[0]?.file?.text())?.trim().split("\n") ?? [];
    expect(lines[0]).toBe("country,population");
    expect(lines).toHaveLength(11);
  });

  it("say Export failed for two seconds and report the demo id when the export fails", async () => {
    document.body.innerHTML = await figureHtml(exportFixture);
    const handle = { instance: () => null } as unknown as LiveHandle;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    wireDemoControls(demoElement(EXPORT), handle).reveal();
    vi.useFakeTimers();
    const svgButton = button(EXPORT, "Download SVG");
    svgButton.click();
    await vi.waitFor(() => expect(svgButton.textContent).toBe("Export failed"));
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Demo "fixtures/export"'),
      expect.any(Error),
    );
    vi.advanceTimersByTime(2000);
    expect(svgButton.textContent).toBe("Download SVG");
  });
});
