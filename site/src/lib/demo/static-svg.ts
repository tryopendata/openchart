/**
 * Renders a spec to a static SVG string at build time, with no DOM, using the
 * library's own static renderer. The demo figure shows it until the live chart
 * mounts, and it is all a reader without JavaScript sees.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { isGraphSpec, isSankeySpec, isTableSpec } from "@opendata-ai/openchart-core";
import { renderStaticSVG } from "@opendata-ai/openchart-vanilla/static";
import { chartTheme } from "./chart-theme";
import { DEMO_CLASS } from "./markup";

export type StaticSvgOptions = {
  idPrefix: string;
  width: number;
  height: number;
  dark: boolean;
  /** Geometry decimal places. Default 1; 0 suits small figures such as the landing wall's tiles. */
  precision?: number;
};

type StaticSpec = Parameters<typeof renderStaticSVG>[0];

const STATIC_CLASS = DEMO_CLASS.static;
/**
 * Geometry decimal places. The SVG is 720 units wide and scales to the stage,
 * so a tenth of a unit never shows, and the library's default of 3 adds weight.
 */
const STATIC_PRECISION = 1;

function hasStaticRenderer(spec: VizSpec): spec is StaticSpec {
  return !isTableSpec(spec) && !isGraphSpec(spec) && !isSankeySpec(spec);
}

/** Adds the class the demo CSS keys on to the root `<svg>`, keeping any class it already has. */
function markStatic(svg: string): string {
  const openTag = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const marked = /\sclass="/.test(openTag)
    ? openTag.replace(/\sclass="/, ` class="${STATIC_CLASS} `)
    : openTag.replace(/^<svg\b/, `<svg class="${STATIC_CLASS}"`);
  return marked + svg.slice(openTag.length);
}

/**
 * The SVG markup with class `demo-static` and a `data-theme` of light or dark,
 * or null when the spec type has no static renderer (table, graph, sankey).
 */
export function staticSvg(spec: VizSpec, options: StaticSvgOptions): string | null {
  if (!hasStaticRenderer(spec)) return null;
  const svg = renderStaticSVG(spec, {
    idPrefix: options.idPrefix,
    width: options.width,
    height: options.height,
    theme: chartTheme(options.dark),
    darkMode: options.dark ? "force" : "off",
    precision: options.precision ?? STATIC_PRECISION,
    // The attribution is a link, and a link inside an image fails axe. The site's own footer credits the library.
    watermark: false,
  });
  return markStatic(svg);
}
