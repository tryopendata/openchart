/**
 * Telling the reader's scrolls from the page's, through a real happy-dom
 * window: the page scrolls through `scrollByPage`, the reader by moving the
 * scroll (`scrollTo` plus the scroll event a browser would fire) with or
 * without an input event first. The navigation type is a browser global, so
 * the reload case stubs it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollByPage, scrollMovedByPage, whenReaderScrolls } from "./reader-scroll";

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

  it("with an anchor, counts a scroll that moves it in the viewport even while the page grows below", () => {
    let height = 9000;
    let top = 80;
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => height);
    const anchor = document.createElement("section");
    vi.spyOn(anchor, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
    const reader = vi.fn();
    watchers.push(whenReaderScrolls(window, reader, anchor));
    // An island below hydrates (1,000px taller) in the frame the reader scrolls 300px with no input event.
    height = 10_000;
    top = -220;
    scrollTo(300);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("with an anchor, does not count scroll anchoring that leaves it where it was", () => {
    const top = 80;
    const anchor = document.createElement("section");
    vi.spyOn(anchor, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
    const reader = vi.fn();
    watchers.push(whenReaderScrolls(window, reader, anchor));
    // Content above grew 600px; the browser moved the scroll by the same amount, so the anchor did not move.
    scrollTo(600);
    expect(reader).not.toHaveBeenCalled();
  });

  it("with an anchor, does not count anchoring that steadies another element and leaves the anchor lower", () => {
    let top = 80;
    const anchor = document.createElement("section");
    vi.spyOn(anchor, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
    const reader = vi.fn();
    watchers.push(whenReaderScrolls(window, reader, anchor));
    // Content above grew 600px; the browser made up 566px of it, so the anchor sits 34px lower.
    top = 114;
    scrollTo(566);
    expect(reader).not.toHaveBeenCalled();
  });

  it("does not count a scroll the page moved by a distance, and still counts a reader's scroll made before it", () => {
    const moved = vi.fn();
    watch(moved);
    // A refresh leaves the scroll 40px further down than it found it.
    window.scrollTo(0, 40);
    scrollMovedByPage(window, 40);
    window.dispatchEvent(new Event("scroll"));
    expect(moved).not.toHaveBeenCalled();

    const reader = vi.fn();
    watch(reader);
    // The reader's scroll has not been reported yet when a refresh that moves nothing runs.
    window.scrollTo(0, 2400);
    scrollMovedByPage(window, 0);
    window.dispatchEvent(new Event("scroll"));
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
