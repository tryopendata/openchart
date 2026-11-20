/**
 * Applies the reader's code tab choice to every demo's tab strip on the page and
 * keeps them in step on each click. Without this script the tabs are plain links
 * and CSS `:target` shows the linked panel; once it runs, `data-demo-choice` on
 * each code block decides which panel demo.css shows. lib/demo/framework-choice.ts
 * owns the stored choice.
 */
import {
  type Framework,
  isFramework,
  readFrameworkChoice,
  writeFrameworkChoice,
} from "../lib/demo/framework-choice";
import { DEMO_ATTR } from "../lib/demo/markup";

function applyFramework(doc: Document, framework: Framework): void {
  for (const code of doc.querySelectorAll<HTMLElement>(`[${DEMO_ATTR.code}]`)) {
    code.setAttribute(DEMO_ATTR.choice, framework);
    for (const tab of code.querySelectorAll<HTMLElement>(`[${DEMO_ATTR.tab}]`)) {
      if (tab.getAttribute(DEMO_ATTR.tab) === framework) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    }
  }
}

function onTabClick(doc: Document, event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const framework = target?.closest(`[${DEMO_ATTR.tab}]`)?.getAttribute(DEMO_ATTR.tab);
  if (!isFramework(framework)) return;
  // The link's hash is the no-JavaScript path; with the script, following it would only scroll.
  event.preventDefault();
  writeFrameworkChoice(framework);
  applyFramework(doc, framework);
}

/** Applies the stored choice to every code tab strip and keeps them in step on each click. */
export function setupFrameworkChoice(doc: Document): void {
  if (!doc.querySelector(`[${DEMO_ATTR.code}]`)) return;
  applyFramework(doc, readFrameworkChoice());
  doc.addEventListener("click", (event) => onTabClick(doc, event));
}
