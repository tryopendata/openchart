/** Renders a spec to a static SVG string at build time, with no DOM. */
import type { VizSpec } from "@opendata-ai/openchart-core";

export type StaticSvgOptions = { idPrefix: string; width: number; height: number; dark: boolean };

/** The SVG markup, or null when the spec type has no static renderer (table, graph, sankey). */
export function staticSvg(_spec: VizSpec, _options: StaticSvgOptions): string | null {
  throw new Error("not implemented");
}
