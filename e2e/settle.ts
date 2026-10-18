import type { Locator } from '@playwright/test';

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
