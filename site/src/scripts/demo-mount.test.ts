/** The site mounts races into disposable hosts beside their static frames. */
import { isRaceSpec, type RaceSpec } from "@opendata-ai/openchart-core";
import { within } from "@testing-library/dom";
import { expect, it, onTestFinished, vi } from "vitest";
import { gdpRace } from "../demos/change-over-time/race";
import { fixtureTable } from "../demos/fixtures/table";
import { mountDemo } from "./demo-mount";

function raceSpec(): RaceSpec {
  const { spec } = gdpRace;
  if (!isRaceSpec(spec)) throw new Error("Expected a race demo.");
  return { ...spec, race: { autoplay: false, duration: 64, holdEnd: 32 } };
}

function player() {
  const stage = document.createElement("div");
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  const live = mountDemo(stage, raceSpec(), { dark: false, entrance: false });
  onTestFinished(() => {
    live.destroy();
    vi.useRealTimers();
  });
  const queries = within(stage);
  return {
    stage,
    live,
    slider: () => queries.getByRole<HTMLInputElement>("slider", { name: "Time" }),
    button: (name: string) => queries.getByRole("button", { name }),
  };
}

it("cancels playback on unmount and leaves the static frame in place", () => {
  const stage = document.createElement("div");
  const fallback = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  stage.append(fallback);
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  try {
    const live = mountDemo(stage, raceSpec(), { dark: true, entrance: false });
    const player = stage.querySelector(".oc-race-root");
    try {
      expect(player).toHaveClass("oc-dark");
      expect(within(stage).getByRole("slider", { name: "Time" })).toHaveAttribute(
        "aria-valuetext",
        "1980",
      );
      within(stage).getByRole("button", { name: "Play" }).click();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    } finally {
      live.destroy();
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(player?.parentElement).toBeNull();
    expect([...stage.children]).toEqual([fallback]);
  } finally {
    vi.useRealTimers();
  }
});

it.each(["paused", "playing", "ended"] as const)(
  "redraws in the new theme and keeps playback at the %s race's playhead",
  (state) => {
    const { stage, live, slider, button } = player();
    button("Play").click();
    vi.advanceTimersByTime(state === "ended" ? 128 : 48);
    if (state === "paused") button("Pause").click();
    const before = Number(slider().value);
    expect(before).toBeGreaterThan(0);
    if (state === "ended") expect(before).toBe(44);
    else expect(before).toBeLessThan(44);
    const liveRegion = stage.querySelector('[aria-live="polite"]');
    const host = stage.querySelector(".demo-live");
    if (!host) throw new Error("Expected a live demo host.");
    const observer = new MutationObserver(() => {});
    observer.observe(host, { childList: true });
    onTestFinished(() => observer.disconnect());

    live.setTheme?.(true);

    const mutations = observer.takeRecords();
    expect(stage.querySelector(".oc-race-root")).toHaveClass("oc-dark");
    expect(stage.querySelector('[aria-live="polite"]')).toBe(liveRegion);
    expect(mutations.length).toBeGreaterThan(0);
    let roots = 1;
    for (const { addedNodes, removedNodes } of mutations) {
      roots += addedNodes.length - removedNodes.length;
      expect(roots).toBeLessThanOrEqual(1);
    }
    expect(roots).toBe(1);
    expect(Number(slider().value)).toBe(before);
    if (state === "playing") {
      expect(button("Pause")).toBeDefined();
      vi.advanceTimersByTime(16);
      expect(Number(slider().value)).toBeGreaterThan(before);
    } else {
      button("Play").click();
      expect(Number(slider().value)).toBe(state === "ended" ? 0 : before);
      expect(button("Pause")).toBeDefined();
    }
  },
);

it("swaps the race mark at the current fractional playhead", () => {
  const { stage, live, slider, button } = player();
  const scrubber = slider();
  scrubber.value = "18.5";
  scrubber.dispatchEvent(new Event("input", { bubbles: true }));

  live.update?.({ ...raceSpec(), mark: "line" });

  expect(stage.querySelector(".oc-race-line path[data-key]")).not.toBeNull();
  expect(slider()).toHaveValue("18.5");
  expect(button("Play")).toBeDefined();
});

it("disconnects both observers when a race is removed before it enters view", () => {
  const intersection = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
  const resize = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = intersection.observe;
      unobserve = intersection.unobserve;
      disconnect = intersection.disconnect;
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = resize.observe;
      disconnect = resize.disconnect;
    },
  );
  const layout = vi
    .spyOn(document.documentElement, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 1280, 800));
  onTestFinished(() => {
    layout.mockRestore();
    vi.unstubAllGlobals();
  });

  const stage = document.createElement("div");
  const live = mountDemo(
    stage,
    { ...raceSpec(), race: { autoplay: "visible" } },
    { dark: false, entrance: false },
  );
  try {
    const host = stage.querySelector(".demo-live");
    expect(host).not.toBeNull();
    expect(intersection.observe).toHaveBeenCalledWith(host);
    expect(resize.observe).toHaveBeenCalledWith(host);
    expect(within(stage).getByRole("button", { name: "Play" })).toBeDefined();
  } finally {
    live.destroy();
  }
  expect(intersection.disconnect).toHaveBeenCalledOnce();
  expect(resize.disconnect).toHaveBeenCalledOnce();
  expect(stage).toBeEmptyDOMElement();
});

it("exposes no update for a standalone table demo", () => {
  const stage = document.createElement("div");
  const live = mountDemo(stage, fixtureTable.spec, { dark: false, entrance: false });
  onTestFinished(live.destroy);
  expect(live.update).toBeUndefined();
});
