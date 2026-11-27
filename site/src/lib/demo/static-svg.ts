/**
 * Renders a spec to a static SVG string at build time, with no DOM, using the
 * library's own static renderer. The demo figure shows it until the live chart
 * mounts, and it is all a reader without JavaScript sees.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";
import { isGraphSpec, isRaceSpec, isSankeySpec, isTableSpec } from "@opendata-ai/openchart-core";
import { renderRaceStaticSVG, renderStaticSVG } from "@opendata-ai/openchart-vanilla/static";
import { chartTheme } from "./chart-theme";
import { dropInheritedType } from "./inherited-type";
import { DEMO_CLASS } from "./markup";
import { measureRaceText } from "./race-text";
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
/** The wrapper demo.css switches drawings inside, by their `data-static-size`. */
const STATIC_SET_CLASS = "demo-static-set";
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
  if (!hasStaticRenderer(spec)) return null;
  const race = isRaceSpec(spec);
  const siteTheme = chartTheme(options.dark);
  const theme = options.theme ?? siteTheme;
  const renderOptions = {
    idPrefix: options.idPrefix,
    width: options.width,
    height: options.height,
    theme,
    darkMode: options.dark ? "force" : "off",
    precision: options.precision ?? (race ? 2 : STATIC_PRECISION),
    // The attribution is a link, and a link inside an image fails axe. The site's own footer credits the library.
    watermark: false,
  } as const;
  const svg = race
    ? renderRaceStaticSVG(
        { ...spec, watermark: false },
        {
          ...renderOptions,
          measureText:
            theme.fonts?.family === siteTheme.fonts?.family ? measureRaceText : undefined,
        },
      )
    : renderStaticSVG(spec, renderOptions);
  const marked = dropInheritedType(markStatic(svg));
  return race ? marked : slimSvg(marked);
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

/**
 * A viewport width range a static drawing can be shown in, as demo.css names
 * them, on Tailwind's sm, lg and xl breakpoints: `phone` under 40rem, `tablet`
 * from 40rem, `lg` from 64rem and `xl` from 80rem.
 */
export type StaticRange = "phone" | "tablet" | "lg" | "xl";

const STATIC_RANGES: readonly StaticRange[] = ["phone", "tablet", "lg", "xl"];

/** One drawing in a static set: the size it is laid out at and the ranges it is shown in. */
export type StaticDrawing = Omit<StaticSvgOptions, "dark"> & {
  ranges: readonly StaticRange[];
};

/** A static set whose drawings leave a range without a drawing, or give it two that would overlap. */
export class StaticSetError extends Error {
  override name = "StaticSetError";
}

/** Throws unless the drawings between them name every range exactly once, so one drawing shows at any width. */
function checkRangesCovered(drawings: readonly StaticDrawing[]): void {
  const named = drawings.flatMap((drawing) => drawing.ranges);
  for (const range of STATIC_RANGES) {
    const count = named.filter((name) => name === range).length;
    if (count !== 1) {
      const prefixes = drawings.map((drawing) => drawing.idPrefix).join(", ");
      throw new StaticSetError(
        `Static set ${prefixes}: range "${range}" is named by ${count} drawings; ` +
          `each of ${STATIC_RANGES.join(", ")} must be named by exactly one.`,
      );
    }
  }
}

/**
 * The spec drawn at several sizes, each as a light and dark pair
 * (`staticSvgPair`), in one `.demo-static-set` whose children carry
 * `data-static-size` with the ranges they cover; demo.css shows only the child
 * for the viewport's range. Null when the spec type has no static renderer.
 * Throws when the drawings do not name every range exactly once.
 */
export function staticSvgSet(spec: VizSpec, drawings: readonly StaticDrawing[]): string | null {
  checkRangesCovered(drawings);
  const children: string[] = [];
  for (const { ranges, ...options } of drawings) {
    const pair = staticSvgPair(spec, options);
    if (pair === null) return null;
    children.push(staticSetChild(ranges, pair));
  }
  return staticSetHtml(children);
}

/** One drawing of a static set: `html` shown only in the viewport `ranges`. */
export function staticSetChild(ranges: readonly StaticRange[], html: string): string {
  return `<div data-static-size="${ranges.join(" ")}">${html}</div>`;
}

/** The set demo.css switches, around children built by `staticSetChild`. */
export function staticSetHtml(children: readonly string[]): string {
  return `<div class="${STATIC_SET_CLASS}">${children.join("")}</div>`;
}
