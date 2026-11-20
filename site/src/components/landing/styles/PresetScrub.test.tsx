/**
 * The PresetScrub island without motion (the narrow-screen and reduced-motion
 * path): the stops are buttons, each press names the preset and shows the theme
 * lines it changed, and the static chart stands in until the library loads.
 * GSAP is the one boundary replaced: `withMotion` runs nothing, as it does for a
 * reader who prefers reduced motion, so nothing pins.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { houseStyle } from "../../../demos/landing/house-style";
import { HOUSE_STYLE_STOPS, houseStyleDiffs } from "./house-styles";
import { PresetScrub } from "./PresetScrub";

vi.mock("../../../scripts/motion", () => ({ withMotion: () => () => undefined }));

const diffs = houseStyleDiffs();
const stops = HOUSE_STYLE_STOPS.map((stop, index) => ({ ...stop, diff: diffs[index] ?? [] }));

function renderScrub() {
  return render(
    <PresetScrub stops={stops} spec={houseStyle.spec as ChartSpec}>
      <p>static chart</p>
    </PresetScrub>,
  );
}

const presetName = (container: HTMLElement) =>
  container.querySelector("[data-preset-name]")?.textContent;

describe("the house-style scrub without motion", () => {
  it("starts on essay with its lines and the static chart, and is not pinned", () => {
    const { container } = renderScrub();
    expect(presetName(container)).toBe("Essay");
    expect(screen.getByRole("button", { name: "Essay" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("static chart")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Theme values changed here" })).toHaveTextContent(
      'fonts.family: "Source Serif 4"',
    );
    expect(container.querySelector("[data-pinned]")).toBeNull();
  });

  it("moves through every stop on its button and announces each", async () => {
    const user = userEvent.setup();
    const { container } = renderScrub();
    for (const stop of stops) {
      await user.click(screen.getByRole("button", { name: stop.label }));
      expect(presetName(container)).toBe(stop.label);
      expect(screen.getByRole("button", { name: stop.label })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByText(`House style: ${stop.label}`)).toBeInTheDocument();
    }
    const lines = screen.getByRole("list", { name: "Theme values changed here" });
    expect(lines).toHaveTextContent('darkMode: "force"');
    // Without motion the outgoing lines are never kept for a crossfade.
    expect(container.querySelectorAll(".scrub-lines")).toHaveLength(1);
  });
});
