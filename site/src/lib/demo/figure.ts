/**
 * The demo markup contract, as one HTML string: a figure holding the stage
 * (a light and a dark static SVG, or a placeholder line when there is none) and
 * its caption, then the embedded spec the live mount reads, any shared value
 * blocks and the code toolbar.
 * Demo.astro and the `json demo` fence plugin both render through this, so the
 * two ways of putting a chart on a page cannot drift apart.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import type { DemoSource } from "../../demos/types";
import { codeTabsHtml } from "./code-tabs";
import { demoDomId } from "./dom-id";
import { escapeHtml } from "./escape-html";
import { DEMO_ATTR, DEMO_CLASS } from "./markup";
import { type SharedSplit, splitSharedValues } from "./shared-values";
import { staticSvg } from "./static-svg";

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
};

/** Static SVGs are laid out at this width; CSS scales them to the stage. */
const STATIC_WIDTH = 720;
const PLACEHOLDER_TEXT = "This chart is drawn in the browser.";

/**
 * JSON that is safe inside a `<script>` element: escaping `<` keeps a string such
 * as `</script>` from closing the element early, and JSON.parse reads it back.
 */
const scriptSafe = (json: string) => json.replaceAll("<", "\\u003c");

function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** What a stage with no static SVG shows until its chart mounts, and all a reader without JavaScript sees. */
function placeholderHtml(figure: DemoFigure): string {
  const text = `${asSentence(figure.title)} ${PLACEHOLDER_TEXT}`;
  return `<p class="${DEMO_CLASS.placeholder}" ${DEMO_ATTR.placeholder}>${escapeHtml(text)}</p>`;
}

function stageHtml(figure: DemoFigure, domId: string): string {
  const size = { width: STATIC_WIDTH, height: figure.height };
  const render = (dark: boolean, suffix: string) =>
    figure.static
      ? staticSvg(figure.spec, { ...size, idPrefix: `${domId}-${suffix}`, dark })
      : null;
  const light = render(false, "l");
  const content = light === null ? placeholderHtml(figure) : `${light}${render(true, "d") ?? ""}`;
  const style = `--demo-height: ${figure.height}px`;
  return `<div class="demo-stage" ${DEMO_ATTR.stage} style="${style}">${content}</div>`;
}

function embeddedSpec(figure: DemoFigure): SharedSplit {
  if (!figure.pageShared) return { specJson: JSON.stringify(figure.spec), refs: [], values: [] };
  return splitSharedValues(figure.spec, figure.pageShared);
}

// The spec and shared values are data for the live mount, not text for search.
function specHtml({ specJson, refs, values }: SharedSplit): string {
  const refsAttr = refs.length
    ? ` ${DEMO_ATTR.sharedRefs}="${escapeHtml(JSON.stringify(refs))}"`
    : "";
  const spec = `<script type="application/json" ${DEMO_ATTR.spec}${refsAttr} data-pagefind-ignore>${scriptSafe(specJson)}</script>`;
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
  // Claimed before the first await, so two figures rendering at once never both write a block.
  const spec = specHtml(embeddedSpec(figure));
  const code = figure.tabs ? await codeTabsHtml(domId, figure.spec) : "";
  return [
    `<div class="demo not-prose" ${DEMO_ATTR.figure}="${escapeHtml(figure.id)}"${entrance}>`,
    `<figure class="demo-figure">${stageHtml(figure, domId)}${captionHtml(figure)}</figure>`,
    spec,
    code,
    "</div>",
  ].join("");
}
