import type { Locator, Page } from '@playwright/test';

/**
 * Mirrors DEBOUNCE_MS in packages/vanilla/src/resize-observer.ts. If that
 * debounce grows, raise this to match or the wait below stops covering it.
 */
const RESIZE_DEBOUNCE_MS = 16;

/**
 * Resolve once the chart mount has handled every ResizeObserver notification
 * for `host`, including the echo of any render those notifications caused.
 *
 * The observer installed here is created after the chart's own, so within one
 * notification the chart schedules its debounce timer first. Timers with equal
 * delay run in scheduling order, so when ours fires the chart's has already
 * run and any render it triggered is in the DOM. A render that changes the
 * host's size produces a new notification, which re-arms ours. The promise
 * therefore resolves only when the host is size-stable; a resize feedback loop
 * never resolves and the test times out.
 */
export async function waitForResizeSettled(host: Locator): Promise<void> {
  await host.evaluate(
    (el, debounceMs) =>
      new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const observer = new ResizeObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, debounceMs);
        });
        observer.observe(el);
      }),
    RESIZE_DEBOUNCE_MS,
  );
}

/**
 * Play every pending entrance to completion, so a spec that measures geometry
 * reads final positions rather than a mid-entrance frame. Pass a locator to
 * settle only the visualizations inside it (a gallery page has dozens).
 *
 * Entrances play when seen, so a root below the fold keeps `oc-animate` until
 * it is scrolled to. Each root is scrolled into view in turn and the class is
 * awaited, then the page scrolls back to where it was (the top, right after
 * `goto`). Roots are queried afresh on each pass because a resize or an update
 * can replace them.
 *
 * Under reduced motion `oc-animate` stays on with nothing playing, so there is
 * nothing to wait for. A root with no size (a closed tab) can't be seen and is
 * skipped. Graphs carry no `oc-animate`: wait on the instance's
 * `entrancePlayed` instead.
 */
export async function settleEntrances(target: Page | Locator, timeoutMs = 10_000): Promise<void> {
  const scope = 'goto' in target ? target.locator(':root') : target;
  await scope.evaluate(async (scope, timeout) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const { scrollX, scrollY } = window;
    const settled = new Set<Element>();
    const roots = () => [
      ...(scope.matches('.oc-animate') ? [scope] : []),
      ...scope.querySelectorAll('.oc-animate'),
    ];
    for (;;) {
      const root = roots().find((el) => {
        if (settled.has(el)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!root) break;
      root.scrollIntoView({ block: 'center', inline: 'nearest' });
      const deadline = performance.now() + timeout;
      while (root.isConnected && root.classList.contains('oc-animate')) {
        if (performance.now() > deadline) {
          throw new Error(
            `settleEntrances: <${root.tagName.toLowerCase()} class="${root.getAttribute('class')}"> kept oc-animate for ${timeout}ms after it was scrolled into view`,
          );
        }
        await frame();
      }
      settled.add(root);
    }
    window.scrollTo(scrollX, scrollY);
    // Let the scroll's layout, and any resize it echoes, land before measuring.
    await frame();
    await frame();
  }, timeoutMs);
}
