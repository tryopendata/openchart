// @vitest-environment node
/** The canvas page's two figures, one on each side of the auto threshold, and the counts its prose states. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canvasAllCounties, canvasWest } from "./canvas";

/** Above this many points a chart with no `renderer` draws its dots on the canvas. */
const AUTO_CANVAS_THRESHOLD = 1000;

const rowsOf = (spec: unknown) => (spec as { data: unknown[] }).data.length;
const page = readFileSync(join(process.cwd(), "src/content/docs/output/canvas.mdx"), "utf8");

describe("canvas page demos", () => {
  it("plots every county and county equivalent of the lower 48 and DC, left to the auto switch", () => {
    expect(rowsOf(canvasAllCounties.spec)).toBe(3108);
    expect(canvasAllCounties.mount?.renderer).toBeUndefined();
    expect(page).toContain("3,108 counties and county equivalents");
  });

  it("asks for the canvas explicitly on a chart under the threshold", () => {
    const rows = rowsOf(canvasWest.spec);
    expect(rows).toBeLessThanOrEqual(AUTO_CANVAS_THRESHOLD);
    expect(canvasWest.mount?.renderer).toBe("canvas");
    expect(page).toContain(`${rows} points`);
  });
});
