/**
 * The demo markup contract, as one HTML string: a figure holding the stage
 * (a light and a dark static SVG, or a placeholder line when there is none) and
 * its caption, then the embedded spec the live mount reads, any shared value
 * blocks and the code toolbar.
 * Demo.astro and the `json demo` fence plugin both render through this, so the
 * two ways of putting a chart on a page cannot drift apart.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";
import type { DemoMountOptions, DemoSource } from "../../demos/types";
import { codeTabsHtml } from "./code-tabs";
import { demoDomId } from "./dom-id";
import { escapeHtml } from "./escape-html";
import { DEMO_ATTR, DEMO_CLASS } from "./markup";
import { type SharedSplit, splitSharedValues } from "./shared-values";
import { staticSvgPair } from "./static-svg";

/** Everything the figure shows, whether it came from the registry or a fence. */
export type DemoFigure = {
  id: string;
  spec: VizSpec;
  title: string;
  source: DemoSource;
  caption?: string;
  height: number;
  entrance: boolean;
  tabs: boolean;
  /** Render the static SVGs at build time. When false the stage waits for the live mount. */
  static: boolean;
  /**
   * The hashes of shared values already written on this page (`pageSharedHashes`).
   * When given, large values move into shared blocks; without it the spec embeds whole.
   */
  pageShared?: Set<string>;
  /** Lay the site's chart theme over the spec's own. Default true; false lets the spec's `theme` show. */
  pageTheme?: boolean;
  /** Layout width of the static SVGs and the stage's maximum width, in px. Default: statics at 720, stage at full width. */
  width?: number;
  /** Host options the live mount passes on, written on the spec script. */
  mount?: DemoMountOptions;
};

/** Static SVGs are laid out at this width; CSS scales them to the stage. */
const STATIC_WIDTH = 720;
const PLACEHOLDER_TEXT = "This chart is drawn in the browser.";

/**
 * JSON that is safe inside a `<script>` element: escaping `<` keeps a string such
 * as `</script>` from closing the element early, and JSON.parse reads it back.
 */
export const scriptSafe = (json: string) => json.replaceAll("<", "\\u003c");

function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** What a stage with no static SVG shows until its chart mounts, and all a reader without JavaScript sees. */
function placeholderHtml(title: string): string {
  const text = `${asSentence(title)} ${PLACEHOLDER_TEXT}`;
  return `<p class="${DEMO_CLASS.placeholder}" ${DEMO_ATTR.placeholder}>${escapeHtml(text)}</p>`;
}

/** What a stage holds before its live chart, for a figure drawn without tabs or caption. */
export type StageContent = {
  spec: VizSpec;
  title: string;
  /** The static SVGs' id prefix base; the light one adds "-l" and the dark one "-d". */
  domId: string;
  height: number;
  /** Layout width of the static SVGs. Default 720. */
  width?: number;
  /** Render static SVGs; when false, or the type has none, the placeholder line stands in. */
  static: boolean;
  /** Geometry decimal places for the static SVGs (see `staticSvg`). */
  precision?: number;
  /** The theme laid over the spec's own for the static SVGs. Default: the site's chart theme. */
  theme?: ThemeConfig;
};

/** The empty mount theme, so a spec's own theme is all the static SVG uses. */
const NO_PAGE_THEME: ThemeConfig = {};

/**
 * The stage's content without the stage element: the light and dark static
 * SVGs, or the placeholder line naming the chart. Demo figures wrap it in their
 * stage; the landing wall wraps it in a tile.
 */
export function stageContentHtml(content: StageContent): string {
  const svgs = content.static
    ? staticSvgPair(content.spec, {
        width: content.width ?? STATIC_WIDTH,
        height: content.height,
        idPrefix: content.domId,
        precision: content.precision,
        theme: content.theme,
      })
    : null;
  return svgs ?? placeholderHtml(content.title);
}

function stageHtml(figure: DemoFigure, domId: string): string {
  const content = stageContentHtml({
    ...figure,
    domId,
    theme: figure.pageTheme === false ? NO_PAGE_THEME : undefined,
  });
  const width = figure.width === undefined ? "" : `; --demo-width: ${figure.width}px`;
  const style = `--demo-height: ${figure.height}px${width}`;
  return `<div class="demo-stage" ${DEMO_ATTR.stage} style="${style}">${content}</div>`;
}

function embeddedSpec(figure: Pick<DemoFigure, "spec" | "pageShared">): SharedSplit {
  if (!figure.pageShared) return { specJson: JSON.stringify(figure.spec), refs: [], values: [] };
  return splitSharedValues(figure.spec, figure.pageShared);
}

// The spec and shared values are data for the live mount, not text for search.
/**
 * The spec a demo's live mount reads, as the `<script>` the demo element holds,
 * plus any shared value block this page has not written yet (see shared-values.ts).
 * For a chart drawn without the figure, such as a landing wall tile; the figure
 * writes the same markup through `demoFigureHtml`.
 */
export function embeddedSpecHtml(spec: VizSpec, pageShared?: Set<string>): string {
  return specHtml(embeddedSpec({ spec, pageShared }));
}

/**
 * A bare demo stage holding `content` (from `stageContentHtml`): the stage the
 * live mount finds, without the figure's height, caption or code. The caller's
 * class sizes it.
 */
export function bareStageHtml(content: string, className: string): string {
  return `<div class="demo-stage ${escapeHtml(className)}" ${DEMO_ATTR.stage}>${content}</div>`;
}

/** The `data-demo-mount` attribute for host options that set anything, else nothing. */
function mountAttr(mount: DemoMountOptions | undefined): string {
  if (!mount || Object.keys(mount).length === 0) return "";
  return ` ${DEMO_ATTR.mountOptions}="${escapeHtml(JSON.stringify(mount))}"`;
}

function specHtml({ specJson, refs, values }: SharedSplit, mount?: DemoMountOptions): string {
  const refsAttr = refs.length
    ? ` ${DEMO_ATTR.sharedRefs}="${escapeHtml(JSON.stringify(refs))}"`
    : "";
  const spec = `<script type="application/json" ${DEMO_ATTR.spec}${refsAttr}${mountAttr(mount)} data-pagefind-ignore>${scriptSafe(specJson)}</script>`;
  const blocks = values.map(
    ({ hash, json }) =>
      `<script type="application/json" ${DEMO_ATTR.shared}="${hash}" data-pagefind-ignore>${scriptSafe(json)}</script>`,
  );
  return spec + blocks.join("");
}

function captionHtml(figure: DemoFigure): string {
  const { label, url } = figure.source;
  const source = url ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` : escapeHtml(label);
  const lead = escapeHtml(asSentence(figure.caption ?? figure.title));
  return `<figcaption class="figure-caption">${lead} Source: ${source}.</figcaption>`;
}

/**
 * The complete demo for one spec: a `<div class="demo">` holding the published
 * figure (the stage, then its caption) and, after it, the embedded spec and the
 * code toolbar. The markup runs in reading order, so focus and screen readers
 * meet the chart, its caption, then the code.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper for the code tabs.
 * @throws {FoldMarkerError} When the spec contains the text fold markers use.
 */
export async function demoFigureHtml(figure: DemoFigure): Promise<string> {
  const domId = demoDomId(figure.id);
  const entrance = figure.entrance ? ` ${DEMO_ATTR.entrance}` : "";
  const ownTheme = figure.pageTheme === false ? ` ${DEMO_ATTR.ownTheme}` : "";
  // Claimed before the first await, so two figures rendering at once never both write a block.
  const spec = specHtml(embeddedSpec(figure), figure.mount);
  const code = figure.tabs ? await codeTabsHtml(domId, figure.spec) : "";
  return [
    `<div class="demo not-prose" ${DEMO_ATTR.figure}="${escapeHtml(figure.id)}"${entrance}${ownTheme}>`,
    `<figure class="demo-figure">${stageHtml(figure, domId)}${captionHtml(figure)}</figure>`,
    spec,
    code,
    "</div>",
  ].join("");
}
