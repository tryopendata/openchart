import { describe, expect, it } from "vitest";
import { exportStatusText, formatBytes } from "./export-status";

describe("formatBytes", () => {
  it("uses bytes, then whole kilobytes, then megabytes to one decimal", () => {
    expect(formatBytes(912)).toBe("912 B");
    expect(formatBytes(18_400)).toBe("18 KB");
    expect(formatBytes(1_240_000)).toBe("1.2 MB");
  });
});

describe("exportStatusText", () => {
  it("is empty when nothing has been exported", () => {
    expect(exportStatusText({ kind: "idle" })).toBe("");
  });

  it("says a format is rendering", () => {
    expect(exportStatusText({ kind: "working", format: "gif" })).toBe("Rendering GIF…");
  });

  it("reports the format and size when done", () => {
    expect(exportStatusText({ kind: "done", format: "svg", bytes: 18_400 })).toBe("SVG, 18 KB");
  });

  it("names the format and the reason when an export fails", () => {
    const text = exportStatusText({ kind: "failed", format: "gif", reason: "gifenc did not load" });
    expect(text).toBe("GIF export failed: gifenc did not load");
  });
});
