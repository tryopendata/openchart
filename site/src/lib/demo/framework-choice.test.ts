/** The stored code tab choice, read and written through the real localStorage. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FRAMEWORK_STORAGE_KEY,
  FRAMEWORKS,
  readFrameworkChoice,
  writeFrameworkChoice,
} from "./framework-choice";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("the framework choice", () => {
  it("lists the five tabs in display order", () => {
    expect(FRAMEWORKS).toEqual(["spec", "react", "vue", "svelte", "vanilla"]);
  });

  it("is Spec until the reader chooses, then the stored choice", () => {
    expect(readFrameworkChoice()).toBe("spec");
    writeFrameworkChoice("svelte");
    expect(localStorage.getItem(FRAMEWORK_STORAGE_KEY)).toBe("svelte");
    expect(readFrameworkChoice()).toBe("svelte");
  });

  it("ignores a stored value that is not a tab id", () => {
    localStorage.setItem(FRAMEWORK_STORAGE_KEY, "angular");
    expect(readFrameworkChoice()).toBe("spec");
  });

  it("falls back to Spec, and writes nothing, when storage is blocked", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    expect(() => writeFrameworkChoice("vue")).not.toThrow();
    expect(readFrameworkChoice()).toBe("spec");
  });
});
