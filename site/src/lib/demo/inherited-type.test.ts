/**
 * Dropping the type settings a static SVG's text repeats from its root: what
 * goes, and the cases where a copy must stay because it is not a repeat.
 */
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { dropInheritedType } from "./inherited-type";
import { staticSvg } from "./static-svg";

const SANS = "&quot;Site Sans&quot;, system-ui, sans-serif";
const root = `<svg style="height: 10px; font-variant-numeric: tabular-nums;" font-family="${SANS}">`;

describe("dropping inherited type", () => {
  it("removes the root's family and tabular figures from each text, as attribute or style", () => {
    const svg =
      `${root}<text font-family="${SANS}" font-variant="tabular-nums" style="fill: #111;">1</text>` +
      `<text style="fill: #222; font-size: 12px; font-family: ${SANS};">2</text>` +
      `<text style="font-family: ${SANS};">3</text></svg>`;
    expect(dropInheritedType(svg)).toBe(
      `${root}<text style="fill: #111;">1</text>` +
        '<text style="fill: #222; font-size: 12px;">2</text><text>3</text></svg>',
    );
  });

  it("gives a map's root the family its property holds, and drops the copies on its text", () => {
    const mapRoot = `<svg class="oc-map" style="--oc-font-family: ${SANS}; --oc-bg: #fff;">`;
    const svg =
      `${mapRoot}<style>#r { --oc-font-family: "Site Sans"; } #r .oc-title { font-family: var(--oc-font-family); }</style>` +
      `<text font-family="${SANS}" font-size="12">ME</text></svg>`;
    expect(dropInheritedType(svg)).toBe(
      `${mapRoot.replace(/>$/, ` font-family="${SANS}">`)}` +
        `<style>#r { --oc-font-family: "Site Sans"; } #r .oc-title { font-family: var(--oc-font-family); }</style>` +
        '<text font-size="12">ME</text></svg>',
    );
  });

  it("leaves every family in place when any element sets another one", () => {
    const svg =
      `${root}<g font-family="Mono"><text font-family="${SANS}">1</text></g>` +
      `<text font-family="${SANS}">2</text></svg>`;
    expect(dropInheritedType(svg)).toBe(svg);
  });

  it("leaves the text alone under a root that sets no family or no tabular figures", () => {
    const svg = `<svg><text font-family="${SANS}" font-variant="tabular-nums">1</text></svg>`;
    expect(dropInheritedType(svg)).toBe(svg);
  });

  it("leaves a rendered chart's text with no family but the root's", () => {
    const svg = staticSvg(fixtureBar.spec, { width: 400, height: 300, idPrefix: "t", dark: false });
    const families = [...(svg ?? "").matchAll(/font-family/g)];
    expect(families).toHaveLength(1);
    expect(svg).toMatch(/^<svg\b[^>]*\sfont-family="/);
  });
});
