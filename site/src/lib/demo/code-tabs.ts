/**
 * The code under a demo: a toolbar row with a Code disclosure button and one
 * Copy button, then the code block: a strip of links (Spec, React, Vue, Svelte,
 * Vanilla) to panels highlighted at build time. The markup runs in the order
 * the row reads, so focus meets Code, Copy, then the code. Without JavaScript
 * the row stays out of sight and the code shows, and the links point at panel
 * ids so the tabs work through `:target`; with it, demo.css closes the block
 * until the reader opens it (scripts/demo-code-toggle.ts) and
 * scripts/framework-choice.ts takes over the tabs. Only the Spec panel shows the data rows: the framework
 * panels show them folded, and so does the Spec panel for geography. The Spec
 * panel writes out at most 12 rows of a list; a longer one shows its first 6
 * and a comment counting the rest. A panel
 * with folds keeps a copy template in a `<template>`, with a marker for each
 * folded value, which scripts/demo-copy.ts fills from the figure's spec when
 * Copy is pressed. The block carries its own token color stylesheet.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import type { DemoMountOptions } from "../../demos/types";
import { escapeElementText, escapeHtml } from "./escape-html";
import {
  type FoldTarget,
  foldTargets,
  isLongList,
  jsonWithMarkers,
  showFolds,
} from "./fold-targets";
import { FRAMEWORKS, type Framework } from "./framework-choice";
import { highlightCode } from "./highlight";
import { DEMO_ATTR, type SpecPath } from "./markup";
import { foldedFrameworkSnippets } from "./snippets";

/** The code a Copy button copies when it differs from what the panel shows. */
type CopyTemplate = { code: string; folds: SpecPath[] };

/** One tab: what it shows, and its copy template when the shown code is folded. */
type CodeTab = { id: Framework; label: string; lang: string; shown: string; copy?: CopyTemplate };

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

/** The Spec tab's folds: geography, and an excerpt of each list too long to write out. */
function specFolds(spec: VizSpec): FoldTarget[] {
  return foldTargets(spec).flatMap((target) => {
    if (target.geography) return [target];
    return isLongList(target) ? [{ ...target, excerpt: true }] : [];
  });
}

/**
 * The Spec tab: the spec as JSON, with its geography folded so a map stays
 * readable. Rows and graph elements stay written out, this is where they are
 * read, up to a cap: a longer list shows its first rows and a comment counting
 * the rest, so a dense demo keeps the page small. Copy fills every fold back in.
 */
function specTab(spec: VizSpec): CodeTab {
  const tab = { id: "spec" as const, label: LABELS.spec, lang: LANGS.spec };
  const folds = specFolds(spec);
  if (folds.length === 0) return { ...tab, shown: JSON.stringify(spec, null, 2) };
  const code = jsonWithMarkers(spec, folds);
  const paths = folds.map(({ path }) => path);
  // JSON with comments, so the fold comments highlight as comments.
  return { ...tab, lang: "jsonc", shown: showFolds(code, folds), copy: { code, folds: paths } };
}

function codeTabsFor(spec: VizSpec, mount?: DemoMountOptions): CodeTab[] {
  const { shown, template, folds } = foldedFrameworkSnippets(spec, mount);
  return FRAMEWORKS.map((id) => {
    if (id === "spec") return specTab(spec);
    const tab = { id, label: LABELS[id], lang: LANGS[id], shown: shown[id] };
    return folds.length === 0 ? tab : { ...tab, copy: { code: template[id], folds } };
  });
}

const panelId = (domId: string, tab: CodeTab) => `${domId}-code-${tab.id}`;

function tabLink(domId: string, tab: CodeTab, index: number): string {
  // Spec is the panel shown before any choice is made, so it starts as current.
  const current = index === 0 ? ' aria-current="true"' : "";
  return `<a class="demo-tab" href="#${panelId(domId, tab)}" ${DEMO_ATTR.tab}="${tab.id}"${current}>${tab.label}</a>`;
}

/** The `<template>` holding the code Copy fills in, with the paths of its folded values. */
function copyTemplate({ copy }: CodeTab): string {
  if (!copy) return "";
  const fills = escapeHtml(JSON.stringify(copy.folds));
  return `<template ${DEMO_ATTR.copySource} ${DEMO_ATTR.copyFills}="${fills}" ${NO_INDEX}>${escapeElementText(copy.code)}</template>`;
}

function panel(domId: string, tab: CodeTab, highlighted: string): string {
  return `<div class="demo-panel" id="${panelId(domId, tab)}" ${DEMO_ATTR.panel}="${tab.id}">${copyTemplate(tab)}${highlighted}</div>`;
}

/**
 * The toolbar row: Code (an `aria-expanded` disclosure for the block below, one
 * stable name in either state) and the demo's one Copy button, with the region
 * that announces a copy. Both buttons ship `hidden` and the script reveals them,
 * so a page without JavaScript shows no dead control.
 */
function toolbarRow(codeId: string): string {
  const toggle = `<button type="button" class="demo-toggle" ${DEMO_ATTR.toggle} aria-expanded="false" aria-controls="${codeId}" hidden>Code</button>`;
  const copy = `<button type="button" class="copy-button" ${DEMO_ATTR.copy} hidden>Copy</button>`;
  const status = `<span class="sr-only" role="status" aria-live="polite" ${DEMO_ATTR.copyStatus}></span>`;
  return `<div class="demo-toolbar-row">${toggle}${copy}${status}</div>`;
}

/**
 * The code toolbar for a spec: the Code and Copy row, then the `data-demo-code`
 * block holding five tab links, five highlighted panels and the stylesheet for
 * their token colors.
 *
 * @param domId The figure's XML-safe id from `demoDomId`, which keeps panel ids unique on a page.
 * @param mount The demo's host options, which the framework tabs pass as props or mount options.
 * @throws {TypeError} When the spec's type has no framework wrapper.
 * @throws {FoldMarkerError} When the spec contains the text fold markers use.
 */
export async function codeTabsHtml(
  domId: string,
  spec: VizSpec,
  mount?: DemoMountOptions,
): Promise<string> {
  const tabs = codeTabsFor(spec, mount);
  const strip = tabs.map((tab, index) => tabLink(domId, tab, index)).join("");
  const { html, css } = await highlightCode(tabs.map(({ shown, lang }) => ({ code: shown, lang })));
  const panels = tabs.map((tab, index) => panel(domId, tab, html[index] ?? "")).join("");
  const codeId = `${domId}-code`;
  const body = `<div class="demo-code-body"><style>${css}</style><div class="demo-tabs">${strip}</div>${panels}</div>`;
  const code = `<div class="demo-code" id="${codeId}" ${DEMO_ATTR.code} ${NO_INDEX}>${body}</div>`;
  return `<div class="demo-toolbar">${toolbarRow(codeId)}${code}</div>`;
}
