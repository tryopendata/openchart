/**
 * Remembers which code tab (Spec, React, Vue, Svelte, Vanilla) the reader chose
 * and applies it to every demo's tab strip on the page. Without this script the
 * tabs are plain links and CSS `:target` shows the linked panel; once it runs,
 * `data-demo-choice` on each code block decides which panel demo.css shows.
 */

const STORAGE_KEY = "openchart:framework";
const FRAMEWORKS = ["spec", "react", "vue", "svelte", "vanilla"] as const;
type Framework = (typeof FRAMEWORKS)[number];
const DEFAULT_FRAMEWORK: Framework = "spec";

const isFramework = (value: string | null | undefined): value is Framework =>
  FRAMEWORKS.includes(value as Framework);

function storedFramework(): Framework {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isFramework(stored) ? stored : DEFAULT_FRAMEWORK;
  } catch {
    // Storage can be blocked (privacy settings, sandboxed frames); Spec is a fine default.
    return DEFAULT_FRAMEWORK;
  }
}

function storeFramework(framework: Framework): void {
  try {
    localStorage.setItem(STORAGE_KEY, framework);
  } catch {
    // Blocked storage only means the choice lasts for this page.
  }
}

function applyFramework(doc: Document, framework: Framework): void {
  for (const code of doc.querySelectorAll<HTMLElement>("[data-demo-code]")) {
    code.dataset.demoChoice = framework;
    for (const tab of code.querySelectorAll<HTMLElement>("[data-demo-tab]")) {
      if (tab.dataset.demoTab === framework) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    }
  }
}

function onTabClick(doc: Document, event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const framework = target?.closest<HTMLElement>("[data-demo-tab]")?.dataset.demoTab;
  if (!isFramework(framework)) return;
  // The link's hash is the no-JavaScript path; with the script, following it would only scroll.
  event.preventDefault();
  storeFramework(framework);
  applyFramework(doc, framework);
}

/** Applies the stored choice to every code tab strip and keeps them in step on each click. */
export function setupFrameworkChoice(doc: Document): void {
  if (!doc.querySelector("[data-demo-code]")) return;
  applyFramework(doc, storedFramework());
  doc.addEventListener("click", (event) => onTabClick(doc, event));
}
