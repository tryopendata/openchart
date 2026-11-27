/**
 * `withMotion` under each motion preference, and when GSAP fails to load. The
 * preference is a browser global, so `matchMedia` is faked with a query list
 * whose `matches` can flip; GSAP runs for real unless a test makes the loader fail.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withMotion } from "./index";
import { loadMotionTools } from "./register";

vi.mock("./register", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./register")>();
  return { loadMotionTools: vi.fn(actual.loadMotionTools) };
});

type Listener = (event: { matches: boolean; media: string }) => void;

/** A fake media preference: every query list it hands out follows `reduce`, and `flip` notifies them. */
function fakeMotionPreference(reduce: boolean) {
  const lists: { media: string; listeners: Set<Listener> }[] = [];
  let reduced = reduce;
  const matchesFor = (query: string) =>
    query.includes("no-preference") ? !reduced : query.includes("reduce") ? reduced : false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      const entry = { media: query, listeners: new Set<Listener>() };
      lists.push(entry);
      return {
        get matches() {
          return matchesFor(query);
        },
        media: query,
        addEventListener: (_: string, listener: Listener) => entry.listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) => entry.listeners.delete(listener),
        addListener: (listener: Listener) => entry.listeners.add(listener),
        removeListener: (listener: Listener) => entry.listeners.delete(listener),
      };
    }),
  );
  return {
    flip(toReduce: boolean) {
      reduced = toReduce;
      for (const { media, listeners } of lists) {
        for (const listener of [...listeners]) listener({ matches: matchesFor(media), media });
      }
    },
  };
}

const loader = vi.mocked(loadMotionTools);

beforeEach(() => {
  loader.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ScrollTrigger keeps a 250ms interval that calls requestAnimationFrame; left running it can
// fire after the test environment is torn down and fail the whole run.
afterAll(async () => {
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  ScrollTrigger.disable();
});

describe("withMotion", () => {
  it("never loads GSAP or runs setup when the reader prefers reduced motion", async () => {
    fakeMotionPreference(true);
    const setup = vi.fn();
    const teardown = withMotion(setup);
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(setup).not.toHaveBeenCalled();
    expect(teardown).not.toThrow();
  });

  it("hands setup registered GSAP tools, and the teardown reverts what setup made", async () => {
    fakeMotionPreference(false);
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
    fakeMotionPreference(false);
    const setup = vi.fn();
    withMotion(setup)();
    await loader.mock.results[0]?.value;
    await Promise.resolve();
    expect(setup).not.toHaveBeenCalled();
  });

  it("reverts setup's work when the reader turns on reduced motion later", async () => {
    const preference = fakeMotionPreference(false);
    const target = document.createElement("div");
    let cleaned = false;
    withMotion(({ gsap }) => {
      gsap.set(target, { x: 40 });
      return () => {
        cleaned = true;
      };
    });
    await vi.waitFor(() => expect(target.style.transform).toContain("40px"));
    preference.flip(true);
    await vi.waitFor(() => expect(cleaned).toBe(true));
    expect(target.style.transform).not.toContain("40px");
  });

  it("logs one error naming the section when GSAP fails to load, and a later call tries again", async () => {
    fakeMotionPreference(false);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    loader.mockRejectedValueOnce(new Error("chunk failed to load"));
    const setup = vi.fn();
    Object.defineProperty(setup, "name", { value: "the hero desk" });
    withMotion(setup);
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(String(error.mock.calls[0]?.[0])).toContain("the hero desk");
    expect(setup).not.toHaveBeenCalled();

    const retried = vi.fn();
    withMotion(retried);
    await vi.waitFor(() => expect(retried).toHaveBeenCalledTimes(1));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
