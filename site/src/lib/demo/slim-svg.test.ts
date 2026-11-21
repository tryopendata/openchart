/**
 * The clean-up every static SVG gets: the attributes and ids only a live chart
 * reads go, and what CSS, ARIA or the SVG's own references need stays.
 */
import { describe, expect, it } from "vitest";
import { slimSvg } from "./slim-svg";

describe("slimming a static SVG", () => {
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

  it("keeps the root id a map's own style rules select", () => {
    const svg =
      '<svg class="oc-map" id="t-oc-root"><style>svg.oc-map#t-oc-root .oc-title { fill: #111; }</style>' +
      '<text class="oc-title" id="t-title">x</text></svg>';
    expect(slimSvg(svg)).toBe(
      '<svg class="oc-map" id="t-oc-root"><style>svg.oc-map#t-oc-root .oc-title { fill: #111; }</style>' +
        '<text class="oc-title">x</text></svg>',
    );
  });
});
