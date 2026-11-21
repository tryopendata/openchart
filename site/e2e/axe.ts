import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

type Violation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

/**
 * Accessibility defects in what packages/ renders, outside this site. Each entry
 * names one rule and the library elements it is known to fail on; anything else
 * that rule reports, and every other rule, still fails the test. Delete an entry
 * when the library is fixed.
 */
const LIBRARY_DEFECTS: Record<string, RegExp> = {
  // Marks and mark groups carry aria-label with no role.
  "aria-prohibited-attr": /^<(g|circle|line|rect|path)\b[^>]*\b(class="oc-mark\b|aria-label=)/,
  // Legend entries are buttons inside an svg with role="img".
  "nested-interactive": /^<svg\b[^>]*\brole="img"/,
  // A bar list is role="list" with a row group between it and its rows.
  "aria-required-children": /^<(svg|g)\b[^>]*\brole="list"[^>]*>|^<svg\b[^>]*\bclass="oc-barlist"/,
  // Legend entries and the table pager label differently from their visible text.
  "label-content-name-mismatch": /^<(g class="oc-legend-entry"|button\b[^>]*\bdata-page-action=)/,
};

/** WCAG 2.1 A and AA violations on the page, less the known library defects inside a mounted chart (`.oc-root`, the class the library puts on its container). */
export async function pageViolations(page: Page): Promise<Violation[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const kept: Violation[] = [];
  for (const violation of violations) {
    const known = LIBRARY_DEFECTS[violation.id];
    const nodes = [];
    for (const node of violation.nodes) {
      const inLiveChart =
        known?.test(node.html) &&
        (await page
          .locator(String(node.target[0]))
          .first()
          .evaluate((el) => el.closest(".oc-root, .oc-barlist, .demo-live") !== null));
      if (!inLiveChart) nodes.push(node);
    }
    if (nodes.length > 0) kept.push({ ...violation, nodes });
  }
  return kept;
}
