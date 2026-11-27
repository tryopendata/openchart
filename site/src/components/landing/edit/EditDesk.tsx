/**
 * The edit section's island: a chart in the library's edit mode whose one
 * callout the reader can drag or nudge, the spec line that changes, and Reset.
 *
 * The island holds only the callout's offset and renders the spec with it. The
 * library reports every edit as a transaction; `acceptedOffset` lets through a
 * move of the callout and nothing else, and `guardEdits` stops the library's
 * other edit gestures (text editing, adding, deleting, selecting the rest)
 * before they start, so nothing on the chart offers an edit the page refuses.
 *
 * Server render and before the library loads: the static SVGs (children) in a
 * box of fixed height and the readout at the starting offset, with the how-to
 * and Reset holding their space but hidden. The live chart replaces the static
 * one only once both the library and the edit tools (the rule, the guard and
 * the touch relay, one lazy chunk) have loaded: an edit chart without its rules
 * would offer edits it cannot apply. If either fails, the static chart stays
 * and the hook that failed logs why.
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
import { flushSync } from "react-dom";
import { Mounted, useChartModule } from "../../shared/LiveChart";
import { usePageChartTheme } from "../../shared/page-theme";
import { CALLOUT_INDEX, type Offset, sameOffset, specWithOffset } from "./callout-offset";
import { EditReadout, type EditReadoutProps } from "./EditReadout";
import { editSpec, startOffset } from "./edit-spec";
import { useCalloutDemo } from "./use-callout-demo";
import { useEditTools } from "./use-edit-tools";
import { usePlotTop } from "./use-plot-top";

/** Where the self-demonstration takes the callout: further down and right, still clear of the line. */
const DEMO_OFFSET: Offset = { dx: 150, dy: 84 };
const CALLOUT_REF = {
  type: "annotation",
  index: CALLOUT_INDEX,
  path: `/annotations/${CALLOUT_INDEX}`,
} as const;

export type EditDeskProps = Pick<EditReadoutProps, "excerpt" | "howTo"> & {
  /** Where the plot starts in the static drawings beside the spec column, in px from the chart's top. */
  staticPlotTops: { lg: number; xl: number };
  /** The static SVGs the island shows until the chart is live. */
  children?: ReactNode;
};

/** The editable chart with its readout and Reset. */
export function EditDesk({ excerpt, howTo, staticPlotTops, children }: EditDeskProps) {
  const module = useChartModule();
  const tools = useEditTools();
  const { theme, darkMode } = usePageChartTheme();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<ChartHandle>(null);
  const [offset, setOffset] = useState<Offset>(startOffset);
  const [live, setLive] = useState(false);
  const markLive = useCallback(() => setLive(true), []);
  const plotTop = usePlotTop({ stage, handle, live });
  const demoRunning = useCalloutDemo({
    root,
    live,
    play: tools?.playCalloutDemo ?? null,
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
      const next = tools?.acceptedOffset(shownSpec.current, transaction);
      if (next) setOffset(next);
    },
    [tools],
  );
  const reset = useCallback(() => {
    // Reset disables itself, which would drop focus to the page: hand it to the callout first,
    // selected on the redrawn chart so the arrow keys carry on from the start.
    flushSync(() => setOffset(startOffset));
    handle.current?.select(CALLOUT_REF);
  }, []);

  useEffect(() => {
    if (live && tools && root.current) return tools.relayDetachedTouches(root.current);
  }, [live, tools]);

  useEffect(() => {
    if (!live || !tools || !stage.current) return;
    return tools.guardEdits(stage.current, {
      selectCallout: () => handle.current?.select(CALLOUT_REF),
      deselect: () => handle.current?.deselect(),
      calloutSelected: () => {
        const selected = handle.current?.getSelectedElement();
        return selected?.type === "annotation" && selected.index === CALLOUT_INDEX;
      },
    });
  }, [live, tools]);

  const deskStyle = {
    "--edit-plot-top-lg": `${staticPlotTops.lg}px`,
    "--edit-plot-top-xl": `${staticPlotTops.xl}px`,
    ...(plotTop === null ? {} : { "--edit-plot-top": `${plotTop}px` }),
  } as CSSProperties;

  return (
    <div className="edit-desk" ref={root} style={deskStyle} data-live={live ? "" : undefined}>
      <div className="edit-stage" ref={stage} data-edit-chart>
        {module && tools ? (
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
        excerpt={excerpt}
        howTo={howTo}
        offset={offset}
        resettable={!demoRunning && !sameOffset(offset, startOffset)}
        busy={demoRunning}
        onReset={reset}
      />
    </div>
  );
}
