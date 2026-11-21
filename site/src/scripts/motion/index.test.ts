/**
 * `withMotion` under each motion preference. The preference is a browser global,
 * so `matchMedia` is the one thing faked; GSAP runs for real.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { withMotion } from "./index";

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("no-preference") ? !reduce : reduce,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withMotion", () => {
  it("runs nothing when the reader prefers reduced motion", async () => {
    preferReducedMotion(true);
    const setup = vi.fn();
    const teardown = withMotion(setup);
    // Give a lazy GSAP load every chance to finish before checking.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(setup).not.toHaveBeenCalled();
    expect(teardown).not.toThrow();
  });

  it("hands setup registered GSAP tools, and the teardown reverts what setup made", async () => {
    preferReducedMotion(false);
    const target = document.createElement("div");
    let cleaned = false;
    const teardown = withMotion(({ gsap, ScrollTrigger, Flip, Draggable }) => {
      expect([ScrollTrigger, Flip, Draggable].every(Boolean)).toBe(true);
      gsap.set(target, { x: 40 });
      return () => {
        cleaned = true;
      };
    });
    await vi.waitFor(() => expect(target.style.transform).toContain("40px"));
    teardown();
    expect(cleaned).toBe(true);
    expect(target.style.transform).not.toContain("40px");
  });

  it("never runs setup when torn down before GSAP has loaded", async () => {
    preferReducedMotion(false);
    const setup = vi.fn();
    withMotion(setup)();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(setup).not.toHaveBeenCalled();
  });
});
