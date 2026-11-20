/** How a tile's chart is drawn: the spec without its chrome, laid out no narrower than the static SVG. */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { tileLayout } from "./tile-scale";
import { TILE_SVG_SIZE, tileSpec } from "./tile-spec";

describe("a tile's spec", () => {
  it("drops the chrome and keeps everything else as the demo wrote it", () => {
    const demo = getDemo("change-over-time/line-basic").spec as VizSpec & { chrome?: unknown };
    expect(demo.chrome).toBeDefined();
    const { chrome: _chrome, ...rest } = demo;
    expect(tileSpec(demo)).toEqual(rest);
  });

  it("leaves a spec without chrome as it is", () => {
    const spec = { mark: "bar", data: [{ a: "x", b: 1 }] } as unknown as VizSpec;
    expect(tileSpec(spec)).toBe(spec);
  });
});

describe("a live tile's layout", () => {
  it("lays out at the cell's width when the cell is at least the static width", () => {
    expect(tileLayout(320)).toEqual({ width: 320, scale: 1 });
    expect(tileLayout(TILE_SVG_SIZE.width)).toEqual({ width: TILE_SVG_SIZE.width, scale: 1 });
  });

  it("lays out at the static width and scales down in a narrower cell", () => {
    const { width, scale } = tileLayout(180);
    expect(width).toBe(TILE_SVG_SIZE.width);
    expect(scale).toBeCloseTo(180 / TILE_SVG_SIZE.width);
  });
});
