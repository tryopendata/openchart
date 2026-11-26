/**
 * The PresetScrub island. The server HTML is the first stop with its static
 * chart and no buttons. Without motion the stops are buttons. With motion, on a
 * screen where the pin fits, the block pins and a button scrolls to its stop;
 * on a narrower one a button changes the stop and the old copy crossfades out.
 * `withMotion` is the boundary replaced: it hands over real GSAP, or nothing, as
 * it does for a reader who prefers reduced motion.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { houseStyle } from "../../../demos/landing/house-style";
import { loadChartLibrary } from "../../shared/LiveChart";
import { HOUSE_STYLE_STOPS, houseStyleDiffs } from "./house-styles";
import { PresetScrub } from "./PresetScrub";

const motion = vi.hoisted(() => ({ on: false }));

vi.mock("../../../scripts/motion", async () => {
  const { gsap } = await import("gsap");
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  const { Flip } = await import("gsap/Flip");
  const { Draggable } = await import("gsap/Draggable");
  gsap.registerPlugin(ScrollTrigger, Flip, Draggable);
  return {
    prefersReducedMotion: () => !motion.on,
    withMotion(setup: (tools: unknown) => undefined | (() => void)) {
      if (!motion.on) return () => undefined;
      const teardown = setup({ gsap, ScrollTrigger, Flip, Draggable });
      return () => teardown?.();
    },
  };
});

const diffs = houseStyleDiffs();
const stops = HOUSE_STYLE_STOPS.map((stop, index) => ({ ...stop, diff: diffs[index] ?? [] }));

const scrub = () => (
  <PresetScrub stops={stops} spec={houseStyle.spec as ChartSpec}>
    <p>static chart</p>
  </PresetScrub>
);

const presetName = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-preset-name]")].map((element) => element.textContent);

function setViewport(width: number, height: number) {
  (window as unknown as { happyDOM: { setViewport(size: object): void } }).happyDOM.setViewport({
    width,
    height,
  });
}

afterEach(() => {
  motion.on = false;
  setViewport(1024, 768);
  window.scrollTo(0, 0);
  document.body.innerHTML = "";
});

describe("the house-style scrub", () => {
  it("sends the first stop, its theme lines behind a disclosure and the static chart, with no buttons", () => {
    const html = renderToString(scrub());
    document.body.innerHTML = html;
    expect(document.querySelector("button")).toBeNull();
    expect(document.querySelector("[data-preset-name]")?.textContent).toBe("Essay");
    expect(document.body.textContent).toContain(stops[0]?.description ?? "missing");
    const details = document.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('fonts.family "Inter Variable"');
    expect(document.body.textContent).toContain("static chart");
  });

  it("without motion, moves through every stop on its button and announces each", async () => {
    const user = userEvent.setup();
    const { container } = render(scrub());
    for (const stop of stops) {
      await user.click(screen.getByRole("button", { name: stop.label }));
      expect(presetName(container)).toEqual([stop.label]);
      expect(screen.getByRole("button", { name: stop.label })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByText(`House style: ${stop.variant ?? stop.label}`)).toBeInTheDocument();
    }
    expect(screen.getByText("Broadsheet, in dark mode")).toBeVisible();
    const lines = container.querySelectorAll(".scrub-lines");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.textContent).toContain('darkMode "off" → becomes "force"');
    expect(container.querySelector("[data-pinned]")).toBeNull();
  });

  it("with motion where the pin fits, pins the block and sends a button to its stop by scrolling", async () => {
    motion.on = true;
    setViewport(1280, 800);
    const user = userEvent.setup();
    const { container } = render(scrub());
    await waitFor(() => expect(container.querySelector("[data-pinned]")).not.toBeNull());
    expect(window.scrollY).toBe(0);
    await user.click(screen.getByRole("button", { name: "Broadsheet" }));
    // The middle of the third of five stretches of a 2-viewport pin.
    expect(window.scrollY).toBeGreaterThan(0);
  });

  it("with motion and no room to pin, changes stop on the button and crossfades the old copy out", async () => {
    motion.on = true;
    setViewport(600, 800);
    const user = userEvent.setup();
    const { container } = render(scrub());
    // Wait for GSAP to reach the island, then change stop.
    await waitFor(() => expect(screen.getByRole("button", { name: "Wire" })).toBeEnabled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    await user.click(screen.getByRole("button", { name: "Wire" }));
    expect(container.querySelector("[data-pinned]")).toBeNull();
    expect(presetName(container)).toEqual(["Wire"]);
    const outgoing = container.querySelectorAll(".scrub-out");
    expect(outgoing.length).toBe(2);
    expect(within(outgoing[0] as HTMLElement).getByText("Essay")).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll(".scrub-out")).toHaveLength(0), {
      timeout: 2000,
    });
  });

  it("replaces the static chart with the live one once the chart library has loaded", async () => {
    const { container } = render(scrub());
    expect(screen.getByText("static chart")).toBeInTheDocument();
    await loadChartLibrary();
    await waitFor(() => expect(screen.queryByText("static chart")).toBeNull());
    // LiveChart drops the static children on render and mounts the chart in an effect after it.
    await waitFor(() => expect(container.querySelector(".scrub-chart svg")).not.toBeNull());
  });
});
