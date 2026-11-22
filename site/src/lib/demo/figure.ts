/**
 * The demo markup contract, as one HTML string: a figure holding the stage
 * (a light and a dark static SVG, or a placeholder line when there is none), any
 * reader controls and its caption, then the embedded spec the live mount reads,
 * the other states' specs, any shared value blocks and the code toolbar.
 * Demo.astro and the `json demo` fence plugin both render through this, so the
 * two ways of putting a chart on a page cannot drift apart.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";
import { isGraphSpec } from "@opendata-ai/openchart-core";
import type { DemoControls, DemoMountOptions, DemoSource } from "../../demos/types";
import type { BlogFigure } from "./blog-figure";
import { codeTabsHtml } from "./code-tabs";
import { demoControlsHtml, embeddedStates } from "./controls";
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
  /** Stage height on phones (the `max-sm` breakpoint), in px. Default: `height`. */
  phoneHeight?: number;
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
  /** Reader controls, drawn as a bar between the stage and the caption (see controls.ts). */
  controls?: DemoControls;
  /** Set on blog posts only: the credit line, reveal entrances and the wide static width (see blog-figure.ts). */
  blog?: BlogFigure;
  /**
   * A post's hero, above the fold: it paints in place with no entrance and no
   * reveal roles, and takes its own DOM ids so the body may show the same demo.
   */
  hero?: boolean;
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

/** Layout width of the phone static SVGs: a common phone, under 400px so compact overrides apply. */
const PHONE_STATIC_WIDTH = 390;
/** The wrapper demo.css shows or hides as one static pair, by `data-static-size`. */
const STATIC_SET_CLASS = "demo-static-set";

/**
 * A second static pair laid out at phone size, so a phone without the live
 * chart (no JavaScript, reduced motion, an evicted chart, print) sees the
 * phone layout, its breakpoint overrides applied, instead of the desktop one
 * letterboxed in the taller stage. Null without a phone height or a static renderer.
 */
function phoneStaticHtml(figure: DemoFigure, domId: string): string | null {
  if (figure.phoneHeight === undefined || !figure.static) return null;
  return staticSvgPair(figure.spec, {
    width: PHONE_STATIC_WIDTH,
    height: figure.phoneHeight,
    idPrefix: `${domId}-p`,
    theme: figure.pageTheme === false ? NO_PAGE_THEME : undefined,
  });
}

function stageHtml(figure: DemoFigure, domId: string): string {
  const wide = stageContentHtml({
    ...figure,
    // A demo's own width wins; the blog's wide width changes only the statics' layout, never the stage's cap.
    width: figure.width ?? figure.blog?.staticWidth,
    domId,
    theme: figure.pageTheme === false ? NO_PAGE_THEME : undefined,
  });
  const phoneStatics = phoneStaticHtml(figure, domId);
  const content =
    phoneStatics === null
      ? wide
      : `<div class="${STATIC_SET_CLASS}" data-static-size="wide">${wide}</div>` +
        `<div class="${STATIC_SET_CLASS}" data-static-size="phone">${phoneStatics}</div>`;
  const width = figure.width === undefined ? "" : `; --demo-width: ${figure.width}px`;
  // Written inline with the desktop height, so the phone height is reserved before any script runs.
  const phone =
    figure.phoneHeight === undefined ? "" : `; --demo-phone-height: ${figure.phoneHeight}px`;
  const style = `--demo-height: ${figure.height}px${phone}${width}`;
  const fit = isGraphSpec(figure.spec) ? "" : ` ${DEMO_ATTR.fit}`;
  // Axis ticks and labels in the SVGs are noise in search results; the caption stays indexed.
  return `<div class="demo-stage" ${DEMO_ATTR.stage}${fit} style="${style}" data-pagefind-ignore>${content}</div>`;
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
  return spec + sharedBlocksHtml(values);
}

function sharedBlocksHtml(values: SharedSplit["values"]): string {
  const blocks = values.map(
    ({ hash, json }) =>
      `<script type="application/json" ${DEMO_ATTR.shared}="${hash}" data-pagefind-ignore>${scriptSafe(json)}</script>`,
  );
  return blocks.join("");
}

/** The other states' specs and any shared value blocks they add, or nothing without states. */
function statesHtml(figure: DemoFigure): string {
  const states = embeddedStates(figure.controls, figure.spec, figure.pageShared);
  if (!states) return "";
  const script = `<script type="application/json" ${DEMO_ATTR.states} data-pagefind-ignore>${scriptSafe(states.json)}</script>`;
  return script + sharedBlocksHtml(states.values);
}

/**
 * Demo.astro's error: thrown there when a page cannot render a registered demo.
 * The message names the page and the demo, and the cause is kept. It lives here
 * because an Astro component's frontmatter cannot export a class.
 */
export class DemoRenderError extends Error {}

/** Thrown when a blog figure's controls or toolbar markup cannot carry its reveal role. */
export class RevealRoleError extends Error {}

/** The reveal role on a blog figure's caption, controls, credit and toolbar: a short lift, as on the landing figures. */
const CHROME_MOTION = ` data-motion="quiet"`;

/** Whether the figure enters with the reveal: blog body figures do, the hero and docs figures don't. */
const reveals = (figure: DemoFigure) => figure.blog !== undefined && !figure.hero;

/** The reveal role attribute on revealed figures, nothing elsewhere. */
const motionAttr = (figure: DemoFigure) => (reveals(figure) ? CHROME_MOTION : "");

function captionHtml(figure: DemoFigure): string {
  const { label, url } = figure.source;
  const source = url ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` : escapeHtml(label);
  const lead = escapeHtml(asSentence(figure.caption ?? figure.title));
  return `<figcaption class="figure-caption"${motionAttr(figure)}>${lead} Source: ${source}.</figcaption>`;
}

const LEADING_TAG = /^<[a-z]+/;

/**
 * Another module's fragment (the controls bar, the code toolbar) with the reveal
 * role on its root element, on blog figures only. The stage never goes through here.
 *
 * @throws {RevealRoleError} When a non-empty fragment does not open with an
 * element, so a markup change fails the build instead of silently dropping the role.
 */
function revealedFragment(fragment: string, figure: DemoFigure): string {
  if (!reveals(figure) || fragment === "") return fragment;
  const tag = LEADING_TAG.exec(fragment)?.[0];
  if (!tag) {
    throw new RevealRoleError(
      `Demo "${figure.id}": a blog figure's controls or toolbar markup must open with an element to carry its reveal role, but starts with "${fragment.slice(0, 40)}".`,
    );
  }
  return tag + CHROME_MOTION + fragment.slice(tag.length);
}

/** The blog figure's "Made with OpenChart" line, linking to how to build its chart type; nothing elsewhere. */
function creditHtml(figure: DemoFigure): string {
  if (!figure.blog) return "";
  const { href, chartName } = figure.blog.credit;
  const link = `<a class="figure-credit-link" href="${escapeHtml(href)}">How to build this ${escapeHtml(chartName)}</a>`;
  return `<p class="figure-credit" data-pagefind-ignore${motionAttr(figure)}>Made with OpenChart. ${link}</p>`;
}

/**
 * The complete demo for one spec: a `<div class="demo">` holding the published
 * figure (the stage, any reader controls, its caption, then on a blog post the
 * credit line) and, after it, the
 * embedded spec, any other states' specs and the code toolbar. The markup runs in reading order, so focus and screen readers
 * meet the chart, its caption, then the code.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper for the code tabs.
 * @throws {FoldMarkerError} When the spec contains the text fold markers use.
 * @throws {RevealRoleError} On a revealed blog figure, when the controls or toolbar markup cannot take a reveal role.
 */
export async function demoFigureHtml(figure: DemoFigure): Promise<string> {
  const domId = demoDomId(figure.id, { hero: figure.hero });
  // The hero is in view at load: an entrance would blank its painted static and redraw from zero.
  const entrance = figure.entrance && !figure.hero ? ` ${DEMO_ATTR.entrance}` : "";
  const ownTheme = figure.pageTheme === false ? ` ${DEMO_ATTR.ownTheme}` : "";
  // Claimed before the first await, so two figures rendering at once never both write a block.
  const spec = specHtml(embeddedSpec(figure), figure.mount) + statesHtml(figure);
  const reveal = reveals(figure) ? " data-reveal" : "";
  const code = figure.tabs ? await codeTabsHtml(domId, figure.spec, figure.mount) : "";
  const controls = revealedFragment(demoControlsHtml(figure), figure);
  return [
    `<div class="demo not-prose" ${DEMO_ATTR.figure}="${escapeHtml(figure.id)}"${entrance}${ownTheme}${reveal}>`,
    `<figure class="demo-figure">${stageHtml(figure, domId)}${controls}${captionHtml(figure)}${creditHtml(figure)}</figure>`,
    spec,
    revealedFragment(code, figure),
    "</div>",
  ].join("");
}
