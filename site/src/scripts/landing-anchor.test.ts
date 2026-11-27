/**
 * The hash holder on the edges a browser test cannot reach cheaply: a hash that
 * is not valid percent-encoding, and a reload. happy-dom has no layout, so the
 * page's height changes come from a stubbed ResizeObserver, which is the
 * browser, not the code under test. Landing and letting go in a real browser
 * are in e2e/landing-anchor.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdHashTarget } from "./landing-anchor";

const resizes: Array<() => void> = [];
const stops: Array<() => void> = [];

beforeEach(() => {
  resizes.length = 0;
  document.body.innerHTML = '<section id="motion"></section>';
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {
        resizes.push(() => this.callback());
      }
      observe() {}
      disconnect() {
        resizes.length = 0;
      }
    },
  );
});

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function holdAt(hash: string) {
  history.replaceState(null, "", `/${hash}`);
  const putBack = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  stops.push(holdHashTarget(document));
  return putBack;
}

describe("holdHashTarget", () => {
  it("does nothing, and throws nothing, for a hash that is not valid percent-encoding", () => {
    const putBack = holdAt("#%E0%A4");
    expect(putBack).not.toHaveBeenCalled();
    expect(resizes).toHaveLength(0);
  });

  it("puts the target back at the top when the page's height changes", () => {
    const putBack = holdAt("#motion");
    putBack.mockClear();
    for (const resize of resizes) resize();
    expect(putBack).toHaveBeenCalledTimes(1);
  });

  it("leaves a reload to the browser's scroll restoration", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "reload" } as unknown as PerformanceEntry,
    ]);
    const putBack = holdAt("#motion");
    expect(putBack).not.toHaveBeenCalled();
    expect(resizes).toHaveLength(0);
  });

  it("lets go after a scroll the reader made with no input event", () => {
    const putBack = holdAt("#motion");
    window.scrollTo(0, 800);
    window.dispatchEvent(new Event("scroll"));
    putBack.mockClear();
    for (const resize of resizes) resize();
    expect(putBack).not.toHaveBeenCalled();
  });
});
