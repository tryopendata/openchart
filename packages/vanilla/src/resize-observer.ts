/**
 * Resize observer: thin wrapper around ResizeObserver with debounce.
 *
 * Watches a container element for size changes and calls back with
 * the new width and height. Debounced at ~60fps (16ms) to avoid
 * excessive re-renders during drag resizes.
 */

const DEBOUNCE_MS = 16;

/**
 * Observe a container element for size changes.
 *
 * @param container - The element to watch.
 * @param callback - Called with (width, height) when size changes.
 * @returns A cleanup function that disconnects the observer.
 */
export function observeResize(
  container: HTMLElement,
  callback: (width: number, height: number) => void,
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const lastDeliveredSize = new Map<Element, { width: number; height: number }>();

  const observer = new ResizeObserver((entries) => {
    // Debounce to ~60fps
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const last = lastDeliveredSize.get(entry.target);
        // Always deliver the first callback for a given target (the initial
        // fire on insertion is load-bearing, see .claude/rules/svg-animation.md).
        // Only dedupe subsequent deliveries whose size didn't actually change.
        if (last && last.width === width && last.height === height) {
          continue;
        }
        lastDeliveredSize.set(entry.target, { width, height });
        callback(width, height);
      }
      timeoutId = null;
    }, DEBOUNCE_MS);
  });

  observer.observe(container);

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    observer.disconnect();
  };
}
