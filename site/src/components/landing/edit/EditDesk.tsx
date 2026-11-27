/**
 * The edit section's island: a chart in the library's edit mode whose one
 * callout the reader can drag or nudge, the spec line that changes, and Reset.
 *
 * The island holds only the callout's offset and renders the spec with it. The
 * library reports every edit as a transaction; `acceptedOffset` lets through a
 * move of the callout and nothing else, so a delete, a double-click add, a
 * title edit or a drag of the target line's label leaves the chart as authored.
 *
 * Server render and before the library loads: the static SVGs (children) in a
 * box of fixed height, the readout at the starting offset and Reset off. The
 * library loads lazily through `useChartModule`, and the edit rules with it
 * (`useEditRules`); if the library cannot load, the static chart stays and
 * `useChartModule` logs why.
 */
import type { EditTransaction } from "@opendata-ai/openchart-core";
import type { ChartHandle } from "@opendata-ai/openchart-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Mounted, useChartModule } from "../../shared/LiveChart";
import { usePageChartTheme } from "../../shared/page-theme";
import { type Offset, sameOffset, specWithOffset } from "./callout-offset";
import { EditReadout } from "./EditReadout";
import { editSpec, startOffset } from "./edit-spec";
import { relayDetachedTouches } from "./touch-drag-relay";
import { useCalloutDemo } from "./use-callout-demo";
import { useEditRules } from "./use-edit-rules";

/** Where the self-demonstration takes the callout: further down and right, still clear of the line. */
const DEMO_OFFSET: Offset = { dx: 150, dy: 84 };

/** The static SVGs the island shows until the chart is live. */
export type EditDeskProps = {
  children?: ReactNode;
};

/** The editable chart with its readout and Reset. */
export function EditDesk({ children }: EditDeskProps) {
  const module = useChartModule();
  const acceptedOffset = useEditRules();
  const { theme, darkMode } = usePageChartTheme();
  const root = useRef<HTMLDivElement>(null);
  const handle = useRef<ChartHandle>(null);
  const [plotTop, setPlotTop] = useState<number | null>(null);
  const [offset, setOffset] = useState<Offset>(startOffset);
  const [live, setLive] = useState(false);
  const markLive = useCallback(() => setLive(true), []);
  const demoRunning = useCalloutDemo({
    root,
    live,
    from: startOffset,
    to: DEMO_OFFSET,
    setOffset,
  });

  const spec = useMemo(() => specWithOffset(editSpec, offset), [offset]);
  // No attribution link inside the chart: this is the library's own site.
  // The engine writes defaults into the spec it compiles, so the chart gets its own copy.
  const liveSpec = useMemo(() => ({ ...structuredClone(spec), watermark: false }), [spec]);
  const shownSpec = useRef(spec);
  shownSpec.current = spec;

  const applyEdit = useCallback(
    (transaction: EditTransaction) => {
      const next = acceptedOffset?.(shownSpec.current, transaction);
      if (next) setOffset(next);
    },
    [acceptedOffset],
  );
  const reset = useCallback(() => setOffset(startOffset), []);

  useEffect(() => {
    if (root.current) return relayDetachedTouches(root.current);
  }, []);

  // The spec beside the chart starts level with the plot, under the chart's own headline.
  // Read once per mount at the starting offset: a moved callout nudges the plot by a few
  // pixels, and the column must not follow it.
  useEffect(() => {
    if (!live) return;
    setPlotTop(handle.current?.instance?.layout.area.y ?? null);
  }, [live]);
  const deskStyle =
    plotTop === null ? undefined : ({ "--edit-plot-top": `${plotTop}px` } as CSSProperties);

  return (
    <div className="edit-desk" ref={root} style={deskStyle}>
      <div className="edit-stage" data-edit-chart>
        {module ? (
          <>
            <module.Chart
              ref={handle}
              spec={liveSpec}
              theme={theme}
              darkMode={darkMode}
              interaction="edit"
              onEdit={applyEdit}
              className="edit-live"
            />
            <Mounted onMounted={markLive} />
          </>
        ) : (
          children
        )}
      </div>
      <EditReadout
        offset={offset}
        resettable={!demoRunning && !sameOffset(offset, startOffset)}
        busy={demoRunning}
        onReset={reset}
      />
    </div>
  );
}
