/**
 * The code tabs under a demo: a strip of links (Spec, React, Vue, Svelte, Vanilla)
 * to panels highlighted at build time. The links point at panel ids so the tabs
 * work without JavaScript through `:target`; scripts/framework-choice.ts takes
 * over when it runs. Only the Spec panel shows the data rows: the framework
 * panels show them folded, and keep the complete code in a `<template>` that the
 * Copy button copies. The block carries its own token color stylesheet.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { escapeElementText } from "./escape-html";
import { FRAMEWORKS, type Framework } from "./framework-choice";
import { highlightCode } from "./highlight";
import { DEMO_ATTR } from "./markup";
import { foldedFrameworkSnippets, frameworkSnippets } from "./snippets";

/** One tab: what it shows, and the complete code its Copy button copies when that differs. */
type CodeTab = { id: Framework; label: string; lang: string; shown: string; copied?: string };

const LABELS: Record<Framework, string> = {
  spec: "Spec",
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  vanilla: "Vanilla",
};
const LANGS: Record<Framework, string> = {
  spec: "json",
  react: "tsx",
  vue: "vue",
  svelte: "svelte",
  vanilla: "ts",
};
/** Search indexes the page's prose, not its code. */
const NO_INDEX = "data-pagefind-ignore";

function codeTabsFor(spec: VizSpec): CodeTab[] {
  const full = frameworkSnippets(spec);
  const folded = foldedFrameworkSnippets(spec);
  return FRAMEWORKS.map((id) => {
    const tab = { id, label: LABELS[id], lang: LANGS[id] };
    if (id === "spec") return { ...tab, shown: JSON.stringify(spec, null, 2) };
    return full[id] === folded[id]
      ? { ...tab, shown: full[id] }
      : { ...tab, shown: folded[id], copied: full[id] };
  });
}

const panelId = (domId: string, tab: CodeTab) => `${domId}-code-${tab.id}`;

function tabLink(domId: string, tab: CodeTab, index: number): string {
  // Spec is the panel shown before any choice is made, so it starts as current.
  const current = index === 0 ? ' aria-current="true"' : "";
  return `<a class="demo-tab" href="#${panelId(domId, tab)}" ${DEMO_ATTR.tab}="${tab.id}"${current}>${tab.label}</a>`;
}

function panel(domId: string, tab: CodeTab, highlighted: string): string {
  const copy = `<button type="button" class="demo-copy" ${DEMO_ATTR.copy} hidden>Copy</button>`;
  const source = tab.copied
    ? `<template ${DEMO_ATTR.copySource} ${NO_INDEX}>${escapeElementText(tab.copied)}</template>`
    : "";
  return `<div class="demo-panel" id="${panelId(domId, tab)}" ${DEMO_ATTR.panel}="${tab.id}">${copy}${source}${highlighted}</div>`;
}

/**
 * The `data-demo-code` block for a spec: five tab links, five highlighted panels
 * and the stylesheet for their token colors.
 *
 * @param domId The figure's XML-safe id from `demoDomId`, which keeps panel ids unique on a page.
 * @throws {TypeError} When the spec's type has no framework wrapper.
 */
export async function codeTabsHtml(domId: string, spec: VizSpec): Promise<string> {
  const tabs = codeTabsFor(spec);
  const strip = tabs.map((tab, index) => tabLink(domId, tab, index)).join("");
  const { html, css } = await highlightCode(tabs.map(({ shown, lang }) => ({ code: shown, lang })));
  const panels = tabs.map((tab, index) => panel(domId, tab, html[index] ?? "")).join("");
  return `<div class="demo-code" ${DEMO_ATTR.code} ${NO_INDEX}><style>${css}</style><div class="demo-tabs">${strip}</div>${panels}</div>`;
}
