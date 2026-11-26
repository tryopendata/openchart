/**
 * The content of the landing framework tabs, built at build time: one panel per
 * wrapper with its install command, a file name and the code the docs demo tabs
 * generate for the same spec. Start.astro highlights it and hands it to the
 * InstallTabs island.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { foldedFrameworkSnippets, frameworkSnippets } from "../../../lib/demo/snippets";
import { LANDING_FRAMEWORKS, type LandingFramework } from "./framework-tabs";

const LABELS: Record<LandingFramework, string> = {
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  vanilla: "Vanilla",
};

/** The file each sample would live in, and the grammar Shiki highlights it with. */
const FILES: Record<LandingFramework, { file: string; lang: string }> = {
  react: { file: "SolarChart.tsx", lang: "tsx" },
  vue: { file: "SolarChart.vue", lang: "vue" },
  svelte: { file: "SolarChart.svelte", lang: "svelte" },
  vanilla: { file: "solar-chart.ts", lang: "ts" },
};

/** One tab's content before highlighting. */
export type FrameworkPanel = {
  id: LandingFramework;
  label: string;
  install: string;
  file: string;
  lang: string;
  /** The sample as shown, data rows folded the way the docs tabs fold them. */
  shown: string;
  /** The complete sample, which Copy puts on the clipboard. */
  code: string;
};

/** The npm command that installs one wrapper. */
export function installCommand(framework: LandingFramework): string {
  return `npm install @opendata-ai/openchart-${framework}`;
}

/**
 * The four panels for a spec, in tab order.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper (from `frameworkSnippets`).
 */
export function frameworkPanels(spec: VizSpec): FrameworkPanel[] {
  const complete = frameworkSnippets(spec);
  const { shown } = foldedFrameworkSnippets(spec);
  return LANDING_FRAMEWORKS.map((id) => ({
    id,
    label: LABELS[id],
    install: installCommand(id),
    ...FILES[id],
    shown: shown[id],
    code: complete[id],
  }));
}
