/**
 * Tells a landing island that the code its live chart needs did not load, so
 * it can show StillNote. It only records the failure: the loaders' own callers
 * (useChartModule, useEditTools) log the error once, where they handle it.
 */
import { useEffect, useState } from "react";

/**
 * True once `load` has rejected. `load` should share its request with the code
 * that uses the module (loadChartLibrary does; a dynamic import does by
 * module), so this adds no download. Keep its identity stable.
 */
export function useLoadFailed(load: () => Promise<unknown>): boolean {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    load().catch(() => {
      // Logged by the loader's own caller; here the failure only changes what the figure says.
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [load]);
  return failed;
}
