/**
 * The code tabs under a demo: a strip of links (Spec, React, Vue, Svelte, Vanilla)
 * to panels highlighted at build time. The links point at panel ids so the tabs
 * work without JavaScript through `:target`; framework-choice.ts takes over when
 * the script runs. Written as an HTML string because the `json demo` fence plugin
 * emits the same markup as Demo.astro and cannot render an Astro component.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { codeToHtml } from "shiki";
import { shikiThemes } from "../../lib/code-themes";
import { frameworkSnippets } from "../../lib/demo/snippets";

type CodeTab = { id: string; label: string; lang: string; code: string };

/** The same dual themes as the site's Markdown code blocks; demo.css picks one per page theme. */

function codeTabsFor(spec: VizSpec): CodeTab[] {
  const snippets = frameworkSnippets(spec);
  return [
    { id: "spec", label: "Spec", lang: "json", code: JSON.stringify(spec, null, 2) },
    { id: "react", label: "React", lang: "tsx", code: snippets.react },
    { id: "vue", label: "Vue", lang: "vue", code: snippets.vue },
    { id: "svelte", label: "Svelte", lang: "svelte", code: snippets.svelte },
    { id: "vanilla", label: "Vanilla", lang: "ts", code: snippets.vanilla },
  ];
}

const panelId = (domId: string, tab: CodeTab) => `${domId}-code-${tab.id}`;

function tabLink(domId: string, tab: CodeTab, index: number): string {
  // Spec is the panel shown before any choice is made, so it starts as current.
  const current = index === 0 ? ' aria-current="true"' : "";
  return `<a class="demo-tab" href="#${panelId(domId, tab)}" data-demo-tab="${tab.id}"${current}>${tab.label}</a>`;
}

async function panel(domId: string, tab: CodeTab): Promise<string> {
  const highlighted = await codeToHtml(tab.code, {
    lang: tab.lang,
    themes: shikiThemes,
    defaultColor: false,
  });
  const copy = '<button type="button" class="demo-copy" data-demo-copy hidden>Copy</button>';
  return `<div class="demo-panel" id="${panelId(domId, tab)}" data-demo-panel="${tab.id}">${copy}${highlighted}</div>`;
}

/**
 * The `data-demo-code` block for a spec: five tab links and five highlighted panels.
 *
 * @param domId The figure's XML-safe id from `demoDomId`, which keeps panel ids unique on a page.
 * @throws {TypeError} When the spec's type has no framework wrapper.
 */
export async function codeTabsHtml(domId: string, spec: VizSpec): Promise<string> {
  const tabs = codeTabsFor(spec);
  const strip = tabs.map((tab, index) => tabLink(domId, tab, index)).join("");
  const panels = await Promise.all(tabs.map((tab) => panel(domId, tab)));
  return `<div class="demo-code" data-demo-code><div class="demo-tabs">${strip}</div>${panels.join("")}</div>`;
}
