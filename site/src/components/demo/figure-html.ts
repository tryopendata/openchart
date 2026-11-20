/**
 * The demo figure markup contract, as one HTML string: the stage with a light and
 * a dark static SVG, the embedded spec the live mount reads, the code tabs and the
 * caption. Demo.astro and the `json demo` fence plugin both render through this,
 * so the two ways of putting a chart on a page cannot drift apart.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import type { DemoSource } from "../../demos/types";
import { demoDomId } from "../../lib/demo/dom-id";
import { staticSvg } from "../../lib/demo/static-svg";
import { codeTabsHtml } from "./code-tabs-html";

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
};

/** The default stage height in px when a demo sets none. */
export const DEFAULT_DEMO_HEIGHT = 400;
/** Static SVGs are laid out at this width; CSS scales them to the stage. */
const STATIC_WIDTH = 720;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

/**
 * The spec as JSON that is safe inside a `<script>` element: escaping `<` keeps a
 * string such as `</script>` from closing the element early, and JSON.parse reads it back.
 */
export function embeddedSpecJson(spec: VizSpec): string {
  return JSON.stringify(spec).replaceAll("<", "\\u003c");
}

function stageHtml(figure: DemoFigure, domId: string): string {
  const size = { width: STATIC_WIDTH, height: figure.height };
  const light = staticSvg(figure.spec, { ...size, idPrefix: `${domId}-l`, dark: false });
  const dark = staticSvg(figure.spec, { ...size, idPrefix: `${domId}-d`, dark: true });
  const style = `--demo-height: ${figure.height}px`;
  return `<div class="demo-stage" data-demo-stage style="${style}">${light ?? ""}${dark ?? ""}</div>`;
}

function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function captionHtml(figure: DemoFigure): string {
  const { label, url } = figure.source;
  const source = url ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` : escapeHtml(label);
  const lead = escapeHtml(asSentence(figure.caption ?? figure.title));
  return `<figcaption class="figure-caption">${lead} Source: ${source}.</figcaption>`;
}

/**
 * The complete `<figure class="demo">` for one demo.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper for the code tabs.
 */
export async function demoFigureHtml(figure: DemoFigure): Promise<string> {
  const domId = demoDomId(figure.id);
  const entrance = figure.entrance ? " data-demo-entrance" : "";
  const spec = `<script type="application/json" data-demo-spec>${embeddedSpecJson(figure.spec)}</script>`;
  const code = figure.tabs ? await codeTabsHtml(domId, figure.spec) : "";
  return [
    `<figure class="demo" data-demo="${escapeHtml(figure.id)}"${entrance}>`,
    stageHtml(figure, domId),
    spec,
    code,
    captionHtml(figure),
    "</figure>",
  ].join("");
}
