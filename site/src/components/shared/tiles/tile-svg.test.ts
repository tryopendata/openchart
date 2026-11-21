/**
 * The clean-up a tile's static SVG gets before it is written to a file: the
 * attributes only a live chart reads go, and runs of same-colored rects, such
 * as a waffle's cells, become one path each without moving a pixel.
 */
import { describe, expect, it } from "vitest";
import { mergeRects, slimSvg } from "./tile-svg";

describe("slimming a tile's SVG", () => {
  it("keeps data-theme, the placeholder hook and referenced ids, and drops the rest", () => {
    const svg =
      '<svg class="demo-static" data-theme="dark" data-mark-count="3" aria-labelledby="t"><title id="t">x</title>' +
      '<clipPath id="clip"></clipPath><g id="loose" data-key="a" clip-path="url(#clip)" data-flag></g></svg>' +
      '<p data-demo-placeholder class="demo-placeholder">x</p>';
    expect(slimSvg(svg)).toBe(
      '<svg class="demo-static" data-theme="dark" aria-labelledby="t"><title id="t">x</title>' +
        '<clipPath id="clip"></clipPath><g clip-path="url(#clip)"></g></svg>' +
        '<p data-demo-placeholder class="demo-placeholder">x</p>',
    );
  });
});

describe("merging a tile's rects", () => {
  it("draws a run of rects that share their paint as one path, corners included", () => {
    const cells =
      '<g><rect x="0" y="0" width="10" height="10" rx="2" ry="2" fill="#aaa"/>' +
      '<rect x="12" y="0" width="10" height="10" rx="2" ry="2" fill="#aaa"/>' +
      '<rect x="24" y="0" width="10" height="10" rx="2" ry="2" fill="#bbb"/>' +
      '<rect x="36" y="0" width="10" height="10" rx="2" ry="2" fill="#bbb"/></g>';
    const corner = (x: number) =>
      `M${x + 2} 0h6a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2z`;
    expect(mergeRects(cells)).toBe(
      `<g><path d="${corner(0)}${corner(12)}" fill="#aaa"/><path d="${corner(24)}${corner(36)}" fill="#bbb"/></g>`,
    );
  });

  it("leaves a lone rect, a rect with children and everything else as they are", () => {
    const svg =
      '<rect x="0" y="0" width="5" height="5" fill="red"/><text>a</text>' +
      '<rect x="1" y="1" width="2" height="2"><title>b</title></rect>';
    expect(mergeRects(svg)).toBe(svg);
  });

  it("lifts each cell out of a group that only marks it, but keeps a group that moves or clips it", () => {
    const marked = (x: number) =>
      `<g class="oc-mark" role="img" aria-label="Coal"><rect x="${x}" y="0" width="5" height="5" fill="red"/></g>`;
    expect(mergeRects(marked(0) + marked(9))).toBe(
      '<path d="M0 0h5v5h-5zM9 0h5v5h-5z" fill="red"/>',
    );
    const moved = '<g transform="translate(3,0)"><rect x="0" y="0" width="5" height="5"/></g>';
    expect(mergeRects(moved + moved)).toBe(moved + moved);
  });

  it("never merges across another element, so paint order holds", () => {
    const svg =
      '<rect x="0" y="0" width="5" height="5" fill="red"/><line x1="0"/>' +
      '<rect x="9" y="0" width="5" height="5" fill="red"/>';
    expect(mergeRects(svg)).toBe(svg);
  });
});
