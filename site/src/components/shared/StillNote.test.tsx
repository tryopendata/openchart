/**
 * The "this is a still" line as an island uses it: useLoadFailed watches the
 * live chart's loader and StillNote says which state the reader is in. Whether
 * the line shows is demo.css's job (checked in the browser tests); here the
 * state and words the server and the island render.
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LIVE_UNAVAILABLE_TEXT, NO_SCRIPT_TEXT, StillNote } from "./StillNote";
import { useLoadFailed } from "./use-load-failed";

function Figure({ load }: { load: () => Promise<unknown> }) {
  return <StillNote failed={useLoadFailed(load)} />;
}

const failsToLoad = () =>
  Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

describe("StillNote with useLoadFailed", () => {
  it("says the chart needs JavaScript until the live code fails", async () => {
    const loaded = Promise.resolve("module");
    render(<Figure load={() => loaded} />);
    await act(() => loaded);
    const note = screen.getByText(NO_SCRIPT_TEXT);
    expect(note).toHaveAttribute("data-still-note", "no-script");
  });

  it("says the live chart did not load once its loader rejects", async () => {
    render(<Figure load={failsToLoad} />);
    const note = await screen.findByText(LIVE_UNAVAILABLE_TEXT);
    expect(note).toHaveAttribute("data-still-note", "failed");
    expect(screen.queryByText(NO_SCRIPT_TEXT)).toBeNull();
  });

  it("keeps an island's own class beside the shared one", () => {
    render(<StillNote failed={false} className="edit-still-note" />);
    expect(screen.getByText(NO_SCRIPT_TEXT)).toHaveAttribute("class", "still-note edit-still-note");
  });
});
