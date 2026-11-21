/**
 * The VocabularyWall island over server-rendered tiles, with motion off (the
 * reduced-motion path, where the filter is instant): the server HTML has no
 * filter buttons, choosing an intent hides the other tiles and records it in
 * the URL hash, arriving on a hash filters and brings the wall into view, and
 * every applied filter is announced. GSAP is the one boundary replaced:
 * `withMotion` runs nothing, as it does for a reader who prefers reduced motion.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VocabularyWall } from "./VocabularyWall";

vi.mock("../../../scripts/motion", () => ({ withMotion: () => () => undefined }));

const intents = [
  { id: "comparison", label: "Comparison", count: 2 },
  { id: "distribution", label: "Distribution", count: 1 },
] as const;

function wall() {
  return (
    <VocabularyWall intents={[...intents]} total={3} sectionId="vocabulary">
      <ul>
        {[
          ["comparison/column-basic", "comparison", "Column"],
          ["comparison/barlist-basic", "comparison", "Bar list"],
          ["distribution/histogram-bins", "distribution", "Histogram"],
        ].map(([demo, intent, label]) => (
          <li key={demo} data-vocabulary-tile={demo} data-intent={intent}>
            <div data-demo-stage />
            <a href={`/docs/${intent}/x/`}>{label}</a>
          </li>
        ))}
      </ul>
    </VocabularyWall>
  );
}

/** The wall inside its section, as the page has it, so arrival can scroll to the section. */
function renderWall() {
  const section = document.createElement("section");
  section.id = "vocabulary";
  section.scrollIntoView = vi.fn();
  document.body.append(section);
  render(wall(), { container: section });
  return section;
}

/**
 * Puts the page at a URL before the island mounts, as an arrival does. happy-dom
 * fires a hashchange after `replaceState` (browsers do not), so let it pass first.
 */
async function arriveAt(url: string) {
  window.history.replaceState(null, "", url);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const shownLinks = () => screen.queryAllByRole("link").map((link) => link.textContent);

afterEach(() => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "";
});

describe("the vocabulary wall", () => {
  it("sends no filter buttons in the server HTML, only every tile", () => {
    const html = renderToString(wall());
    expect(html).not.toContain("<button");
    expect(html).toContain("Histogram");
  });

  it("starts on All with every tile shown, the counts kept out of the button names", () => {
    renderWall();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Distribution" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(shownLinks()).toEqual(["Column", "Bar list", "Histogram"]);
  });

  it("filters to one intent, records it in the hash and announces it, then goes back to All", async () => {
    const user = userEvent.setup();
    renderWall();
    await user.click(screen.getByRole("button", { name: "Comparison" }));
    expect(screen.getByRole("button", { name: "Comparison" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(shownLinks()).toEqual(["Column", "Bar list"]);
    expect(window.location.hash).toBe("#vocabulary=comparison");
    expect(await screen.findByText("Showing 2 comparison charts.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(shownLinks()).toEqual(["Column", "Bar list", "Histogram"]);
    expect(window.location.hash).toBe("#vocabulary");
    expect(screen.getByText("Showing all 3 charts.")).toBeInTheDocument();
  });

  it("on arriving at a filter's hash, filters, announces it and brings the wall into view", async () => {
    await arriveAt("/#vocabulary=distribution");
    const section = renderWall();
    expect(
      await screen.findByRole("button", { name: "Distribution", pressed: true }),
    ).toBeVisible();
    expect(shownLinks()).toEqual(["Histogram"]);
    expect(screen.getByText("Showing 1 distribution chart.")).toBeInTheDocument();
    expect(section.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("stays put on a hash that is not the wall's, and follows a link to a filter within the page", async () => {
    await arriveAt("/#frameworks");
    const section = renderWall();
    expect(shownLinks()).toEqual(["Column", "Bar list", "Histogram"]);
    expect(section.scrollIntoView).not.toHaveBeenCalled();

    // What following an in-page link does: change the hash, which fires one hashchange.
    window.location.hash = "#vocabulary=comparison";
    expect(await screen.findByRole("button", { name: "Comparison", pressed: true })).toBeVisible();
    expect(shownLinks()).toEqual(["Column", "Bar list"]);
    expect(await screen.findByText("Showing 2 comparison charts.")).toBeInTheDocument();
    expect(section.scrollIntoView).toHaveBeenCalledOnce();
  });
});
