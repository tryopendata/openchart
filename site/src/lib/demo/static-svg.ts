/**
 * Renders a spec to a static SVG string at build time, with no DOM, using the
 * library's own static renderer. The demo figure shows it until the live chart
 * mounts, and it is all a reader without JavaScript sees.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";
import { isGraphSpec, isRaceSpec, isSankeySpec, isTableSpec } from "@opendata-ai/openchart-core";
import { renderStaticSVG } from "@opendata-ai/openchart-vanilla/static";
import { chartTheme } from "./chart-theme";
import { dropInheritedType } from "./inherited-type";
import { DEMO_CLASS } from "./markup";
import { raceStaticSvg } from "./race-static-svg";
import { slimSvg } from "./slim-svg";

export type StaticSvgOptions = {
  idPrefix: string;
  width: number;
  height: number;
  dark: boolean;
  /** Geometry decimal places. Default 1; 0 suits small figures such as the landing wall's tiles. */
  precision?: number;
  /**
   * The mount theme, laid over the spec's own. Defaults to the site's
   * `chartTheme`; pass a narrower one when the spec's theme must show through.
   */
  theme?: ThemeConfig;
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
 * its text no longer repeating the root's font settings (inherited-type.ts) and
 * without the data attributes and ids only a live chart reads (slim-svg.ts), or
 * null when the spec type has no static renderer (table, graph, sankey).
 */
export function staticSvg(spec: VizSpec, options: StaticSvgOptions): string | null {
  if (isRaceSpec(spec)) {
    const theme = options.theme ?? chartTheme(options.dark);
    return dropInheritedType(markStatic(raceStaticSvg(spec, { ...options, theme })));
  }
  if (!hasStaticRenderer(spec)) return null;
  const svg = renderStaticSVG(spec, {
    idPrefix: options.idPrefix,
    width: options.width,
    height: options.height,
    theme: options.theme ?? chartTheme(options.dark),
    darkMode: options.dark ? "force" : "off",
    precision: options.precision ?? STATIC_PRECISION,
    // The attribution is a link, and a link inside an image fails axe. The site's own footer credits the library.
    watermark: false,
  });
  return slimSvg(dropInheritedType(markStatic(svg)));
}

/**
 * The light and then the dark static SVG as one string, with element ids under
 * `${idPrefix}-l` and `${idPrefix}-d`; demo.css shows the one for the page's
 * theme. Null when the spec type has no static renderer. Each render gets its
 * own copy of the spec, since rendering writes defaults into it.
 */
export function staticSvgPair(
  spec: VizSpec,
  options: Omit<StaticSvgOptions, "dark">,
): string | null {
  const render = (dark: boolean) =>
    staticSvg(structuredClone(spec), {
      ...options,
      idPrefix: `${options.idPrefix}-${dark ? "d" : "l"}`,
      dark,
    });
  const light = render(false);
  return light === null ? null : `${light}${render(true) ?? ""}`;
}
