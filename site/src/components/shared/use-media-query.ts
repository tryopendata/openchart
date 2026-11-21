/**
 * A CSS media query as island state, updated when it starts or stops matching.
 * The server can't evaluate one, so the caller says what the server render
 * assumes; the first client render then corrects it.
 */
import { useCallback, useSyncExternalStore } from "react";

/** True while `query` matches; `serverValue` on the server. */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
