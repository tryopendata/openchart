/**
 * The page-wide height watcher: it refreshes once the body's height has
 * changed and held still, and not for a resize that keeps the height. happy-dom
 * has no layout, so the body's height and its ResizeObserver are stubbed (the
 * browser), and timers are faked (time).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFRESH_AFTER_MS, refreshOnPageHeightChange } from "./page-height-refresh";

let bodyHeight = 0;
const notify: Array<() => void> = [];

/** The body becomes `height` px tall and the observer hears of it. */
function bodyBecomes(height: number) {
  bodyHeight = height;
  for (const callback of notify) callback();
}

beforeEach(() => {
  vi.useFakeTimers();
  bodyHeight = 5000;
  notify.length = 0;
  vi.spyOn(document.body, "scrollHeight", "get").mockImplementation(() => bodyHeight);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {
        notify.push(() => this.callback());
      }
      observe() {}
      disconnect() {
        notify.length = 0;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("refreshOnPageHeightChange", () => {
  it("refreshes once after the height changes and holds still", () => {
    const refresh = vi.fn();
    refreshOnPageHeightChange(document, refresh);
    bodyBecomes(5200);
    vi.advanceTimersByTime(REFRESH_AFTER_MS / 2);
    bodyBecomes(5400);
    vi.advanceTimersByTime(REFRESH_AFTER_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh for a resize that keeps the page's height", () => {
    const refresh = vi.fn();
    refreshOnPageHeightChange(document, refresh);
    bodyBecomes(5000);
    vi.advanceTimersByTime(REFRESH_AFTER_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes nothing once stopped, even for a change already waiting", () => {
    const refresh = vi.fn();
    const stop = refreshOnPageHeightChange(document, refresh);
    bodyBecomes(5600);
    stop();
    vi.advanceTimersByTime(REFRESH_AFTER_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });
});
