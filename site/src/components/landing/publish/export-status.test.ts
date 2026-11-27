import { describe, expect, it } from "vitest";
import { exportStatusText, failureReason, formatBytes } from "./export-status";

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

  it("says a raster format is rendering and a text format is exporting", () => {
    expect(exportStatusText({ kind: "working", format: "gif" })).toBe("Rendering GIF…");
    expect(exportStatusText({ kind: "working", format: "png" })).toBe("Rendering PNG…");
    expect(exportStatusText({ kind: "working", format: "csv" })).toBe("Exporting CSV…");
  });

  it("names the saved file and its size when a download is done", () => {
    const state = {
      kind: "done",
      format: "svg",
      bytes: 18_400,
      fileName: "openchart-wind-solar-coal.svg",
    } as const;
    expect(exportStatusText(state)).toBe("Saved openchart-wind-solar-coal.svg (18 KB)");
  });

  it("points to the GIF shown in place when a GIF is done", () => {
    const state = {
      kind: "done",
      format: "gif",
      bytes: 1_100_000,
      fileName: "openchart-wind-solar-coal.gif",
    } as const;
    expect(exportStatusText(state)).toBe(
      "GIF ready in place of the chart (1.1 MB). Download it or go back below.",
    );
  });

  it("names the format and the reason when an export fails", () => {
    const text = exportStatusText({ kind: "failed", format: "gif", reason: "gifenc did not load" });
    expect(text).toBe("GIF export failed: gifenc did not load");
  });
});

describe("failureReason", () => {
  it("says the encoder did not download when the GIF chunk fails to load", () => {
    const error = new TypeError(
      "Failed to fetch dynamically imported module: /_astro/export-gif.js",
    );
    expect(failureReason("gif", error)).toBe(
      "the encoder did not download. Reload the page and try again.",
    );
  });

  it("finds a chunk failure in the cause chain", () => {
    const cause = new TypeError("error loading dynamically imported module");
    const error = new Error("GIF export failed to load the gifenc encoder", { cause });
    expect(failureReason("gif", error)).toBe(
      "the encoder did not download. Reload the page and try again.",
    );
  });

  it("gives an unknown error's own message", () => {
    expect(failureReason("png", new Error("Chart is not rendered yet"))).toBe(
      "Chart is not rendered yet",
    );
    expect(failureReason("png", "canvas tainted")).toBe("canvas tainted");
  });
});
