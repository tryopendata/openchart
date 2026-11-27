/**
 * Telling the reader's scrolls from the page's, through a real happy-dom
 * window: the page scrolls through `scrollByPage`, the reader by moving the
 * scroll (`scrollTo` plus the scroll event a browser would fire) with or
 * without an input event first. The navigation type is a browser global, so
 * the reload case stubs it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollByPage, whenReaderScrolls } from "./reader-scroll";

/** Moves the scroll to `top` and fires the scroll event the browser would. */
function scrollTo(top: number) {
  window.scrollTo(0, top);
  window.dispatchEvent(new Event("scroll"));
}

/** Makes this page view a reload still loading, as when the browser restores the scroll. */
function loadingAfterReload() {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { type: "reload" } as unknown as PerformanceEntry,
  ]);
  vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
}

const watchers: Array<() => void> = [];
function watch(onReaderScroll: () => void) {
  watchers.push(whenReaderScrolls(window, onReaderScroll));
}

beforeEach(() => {
  window.scrollTo(0, 0);
});

afterEach(() => {
  for (const stop of watchers.splice(0)) stop();
  vi.restoreAllMocks();
});

describe("whenReaderScrolls", () => {
  it("counts a scroll to a position the page did not set, with no input event, once", () => {
    const reader = vi.fn();
    watch(reader);
    scrollTo(500);
    scrollTo(900);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("does not count a scroll the page made, and counts the reader's next one", () => {
    const reader = vi.fn();
    watch(reader);
    scrollByPage(window, () => window.scrollTo(0, 700));
    window.dispatchEvent(new Event("scroll"));
    expect(reader).not.toHaveBeenCalled();
    scrollTo(760);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("does not count a scroll event that leaves the scroll where it was", () => {
    const reader = vi.fn();
    watch(reader);
    window.dispatchEvent(new Event("scroll"));
    expect(reader).not.toHaveBeenCalled();
  });

  it("does not count a scroll that comes with a change in the page's height", () => {
    let height = 9000;
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => height);
    const reader = vi.fn();
    watch(reader);
    // Content above grew and the browser's scroll anchoring moved the scroll to keep the view.
    height = 9060;
    scrollTo(60);
    expect(reader).not.toHaveBeenCalled();
    scrollTo(400);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("counts a scroll further than the page's height changed, as a reader's scroll during hydration", () => {
    let height = 9000;
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => height);
    const reader = vi.fn();
    watch(reader);
    height = 9060;
    scrollTo(2400);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("counts a scroll after the reader's input even where the page last put it", () => {
    const reader = vi.fn();
    watch(reader);
    scrollByPage(window, () => window.scrollTo(0, 300));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));
    window.dispatchEvent(new Event("scroll"));
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("does not count the browser restoring the scroll while a reload loads", () => {
    loadingAfterReload();
    const reader = vi.fn();
    watch(reader);
    scrollTo(1200);
    expect(reader).not.toHaveBeenCalled();
    window.dispatchEvent(new WheelEvent("wheel"));
    scrollTo(1300);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("counts nothing once stopped", () => {
    const reader = vi.fn();
    const stop = whenReaderScrolls(window, reader);
    stop();
    scrollTo(500);
    expect(reader).not.toHaveBeenCalled();
  });
});
