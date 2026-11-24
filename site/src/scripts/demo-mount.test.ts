/** The site mounts races into disposable hosts beside their static frames. */
import { isRaceSpec } from "@opendata-ai/openchart-core";
import { within } from "@testing-library/dom";
import { expect, it, vi } from "vitest";
import { gdpRace } from "../demos/change-over-time/race";
import { mountDemo } from "./demo-mount";

it("cancels playback on unmount and leaves the static frame in place", () => {
  const stage = document.createElement("div");
  const fallback = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  stage.append(fallback);
  const { spec } = gdpRace;
  if (!isRaceSpec(spec)) throw new Error("Expected a race demo.");
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  try {
    const live = mountDemo(
      stage,
      { ...spec, race: { autoplay: false } },
      { dark: true, entrance: false },
    );
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
