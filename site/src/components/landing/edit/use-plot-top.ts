/**
 * Where the live edit chart's plot starts, for the spec column beside it to
 * start level with.
 *
 * Read from the chart's layout once it is live, and again whenever the chart
 * redraws at a new width: the library lays the chart out again after a resize
 * (debounced, in its own ResizeObserver), so the read waits for the redrawn SVG
 * to land in the stage rather than guessing a delay. Edits redraw the chart at
 * the same width and are not re-read: a moved callout shifts the plot by a few
 * pixels, and the column must not follow it.
 */
import type { ChartHandle } from "@opendata-ai/openchart-react";
import { type RefObject, useEffect, useState } from "react";

/** What the hook watches. */
export type PlotTopSource = {
  /** The box the chart fills. */
  stage: RefObject<HTMLElement | null>;
  handle: RefObject<ChartHandle | null>;
  /** True once the live chart is in the stage. */
  live: boolean;
};

/** The plot's top in px from the chart's top, or null until the live chart has drawn. */
export function usePlotTop({ stage, handle, live }: PlotTopSource): number | null {
  const [plotTop, setPlotTop] = useState<number | null>(null);

  useEffect(() => {
    const element = stage.current;
    if (!live || !element) return;
    let readAtWidth: number | null = null;
    const readIfResized = () => {
      const layout = handle.current?.instance?.layout;
      if (!layout || layout.dimensions.width === readAtWidth) return;
      readAtWidth = layout.dimensions.width;
      setPlotTop(layout.area.y);
    };
    const redraws = new MutationObserver(readIfResized);

    readIfResized();
    redraws.observe(element, { childList: true, subtree: true });
    return () => redraws.disconnect();
  }, [stage, handle, live]);

  return plotTop;
}
