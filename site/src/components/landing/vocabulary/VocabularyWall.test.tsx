/**
 * The VocabularyWall island over server-rendered tiles, with motion off (the
 * reduced-motion path, where the filter is instant): choosing an intent hides
 * the other tiles, the choice goes into the URL hash, and a hash on arrival
 * picks the filter. GSAP is the one boundary replaced: `withMotion` runs nothing,
 * as it does for a reader who prefers reduced motion.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VocabularyWall } from "./VocabularyWall";

vi.mock("../../../scripts/motion", () => ({ withMotion: () => () => undefined }));

const intents = [
  { id: "comparison", label: "Comparison", count: 2 },
  { id: "distribution", label: "Distribution", count: 1 },
] as const;

function renderWall() {
  render(
    <VocabularyWall intents={[...intents]} total={3}>
      <ul>
        {[
          ["comparison/column-basic", "comparison", "Column"],
          ["comparison/lollipop-basic", "comparison", "Lollipop"],
          ["distribution/histogram-basic", "distribution", "Histogram"],
        ].map(([demo, intent, label]) => (
          <li key={demo} data-vocabulary-tile={demo} data-intent={intent}>
            <div data-wall-stage />
            <a href={`/docs/${intent}/x/`}>{label}</a>
          </li>
        ))}
      </ul>
    </VocabularyWall>,
  );
}

const shownLinks = () => screen.queryAllByRole("link").map((link) => link.textContent);

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("the vocabulary wall", () => {
  it("starts on All with every tile shown, the counts kept out of the button names", () => {
    renderWall();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Distribution" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(shownLinks()).toEqual(["Column", "Lollipop", "Histogram"]);
  });

  it("filters to one intent, records it in the hash and announces it, then goes back to All", async () => {
    const user = userEvent.setup();
    renderWall();
    await user.click(screen.getByRole("button", { name: "Comparison" }));
    expect(screen.getByRole("button", { name: "Comparison" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(shownLinks()).toEqual(["Column", "Lollipop"]);
    expect(window.location.hash).toBe("#vocabulary=comparison");
    expect(screen.getByText("Showing 2 comparison charts.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(shownLinks()).toEqual(["Column", "Lollipop", "Histogram"]);
    expect(window.location.hash).toBe("#vocabulary");
  });

  it("opens on the intent a link's hash names, and follows the hash when it changes", async () => {
    window.history.replaceState(null, "", "/#vocabulary=distribution");
    renderWall();
    expect(
      await screen.findByRole("button", { name: "Distribution", pressed: true }),
    ).toBeVisible();
    expect(shownLinks()).toEqual(["Histogram"]);

    window.history.replaceState(null, "", "/#vocabulary=comparison");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(await screen.findByRole("button", { name: "Comparison", pressed: true })).toBeVisible();
    expect(shownLinks()).toEqual(["Column", "Lollipop"]);
  });
});
