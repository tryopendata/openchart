import type { Page } from "@playwright/test";

/**
 * Whether the page can be scrolled sideways by a reader.
 *
 * Measures the document's `scrollWidth` against its `clientWidth`. A page that
 * fits reports `scrollWidth <= clientWidth`, which is zero on a platform whose
 * scrollbar takes layout space and can be negative where `scrollbar-gutter:
 * stable` reserves the bar's space (Linux CI), so compare as an inequality
 * rather than to zero.
 *
 * The measurement itself is guarded: with `overflow-x: hidden` or `clip` on the
 * document, `scrollWidth` can never exceed `clientWidth`, so the measure would
 * pass while content still sticks out of the viewport. The guard walks every
 * element and reports the widest right edge past the viewport, ignoring the
 * document's own hidden overflow.
 */
export async function sidewaysOverflow(page: Page): Promise<{ scroll: number; past: number }> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    let past = 0;
    for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (style.position === "fixed") continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;
      // Content that is meant to scroll inside its own box (a code block, a
      // wide chart on a phone) is clipped to an ancestor; its right edge past
      // the viewport is not the page's.
      let clipped = false;
      for (let parent = element.parentElement; parent && parent !== document.body; ) {
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.overflowX !== "visible") {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (clipped) continue;
      past = Math.max(past, Math.ceil(box.right - width));
    }
    return { scroll: root.scrollWidth - width, past };
  });
}
