/**
 * Whether an island has hydrated. The server render and the first client
 * render both say false, so they match; an island uses it to render controls
 * only once a script is there to make them work, never a dead button.
 */
import { useEffect, useState } from "react";

/** False on the server and in the first client render, true from then on. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
