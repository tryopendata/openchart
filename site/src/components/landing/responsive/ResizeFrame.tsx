/**
 * The resize frame island: a chart in a frame whose right edge is a handle. The
 * handle is a slider ("Chart width") moved by dragging (pointer events) or by
 * keys; a ruler above marks where the library switches between its compact,
 * medium and full layouts. The chart re-lays out through its own resize
 * handling; this island only sets the width of the box the chart sits in.
 *
 * The slider's value is that box's content width, the width the chart lays out
 * at: the frame's border sits outside it (`box-sizing: content-box`), so the
 * readout and the chart's breakpoint agree to the pixel.
 *
 * Server render and before hydration: the chart at its natural width, with no
 * slider, readout or ruler, so no reader meets a control that cannot work.
 */
import {
  BREAKPOINT_COMPACT_MAX,
  BREAKPOINT_MEDIUM_MAX,
  getBreakpoint,
} from "@opendata-ai/openchart-core";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { LiveChart } from "../../shared/LiveChart";
import { clampWidth, type WidthRange, widthAfterKey } from "./frame-width";
import { responsiveSpec } from "./responsive-spec";

/** The narrowest the chart goes: a small phone's chart column. */
const MIN_WIDTH = 280;
/** The frame's left and right border, outside the chart's box. */
const FRAME_BORDER_PX = 2;

export type ResizeFrameProps = {
  /** The static SVGs of the chart at full width. */
  children?: ReactNode;
};

/**
 * The width the chart's box may take: the track's width less the frame's
 * border. Null until measured (server render, or a track that is not laid out).
 */
function useAvailableWidth(track: RefObject<HTMLDivElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    // A zero width means the track is not laid out (hidden, or no layout engine): keep the last real one.
    const measure = () => {
      const measured = Math.floor(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured - FRAME_BORDER_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [track]);
  return width;
}

type Drag = { pointer: number; startX: number; startWidth: number };

/** The frame, its ruler and readout, and the drag handle. */
export function ResizeFrame({ children }: ResizeFrameProps) {
  const track = useRef<HTMLDivElement>(null);
  const available = useAvailableWidth(track);
  const [chosen, setChosen] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);

  const range: WidthRange | null =
    available === null ? null : { min: Math.min(MIN_WIDTH, available), max: available };
  const width = range === null ? null : clampWidth(chosen ?? range.max, range);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (range === null || width === null) return;
    const next = widthAfterKey(event.key, width, range);
    if (next === null) return;
    event.preventDefault();
    setChosen(next);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Only the primary button of the primary pointer drags; a right click opens the menu as usual.
    if (width === null || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startWidth: width };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId || range === null) return;
    setChosen(clampWidth(active.startWidth + event.clientX - active.startX, range));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const breakpoint = width === null ? null : getBreakpoint(width);
  return (
    <div className="resize-figure">
      {width !== null && breakpoint !== null ? (
        <p className="resize-readout">
          <span className="resize-width tabular-nums" data-resize-width>
            {width} px
          </span>
          <span className="resize-breakpoint" data-resize-breakpoint aria-live="polite">
            {breakpoint}
          </span>
          <span className="resize-hint">
            Drag the frame's right edge, or focus it and use the arrow keys.
          </span>
        </p>
      ) : null}
      <div ref={track} className="resize-track" data-measured={range === null ? undefined : ""}>
        {range === null ? null : (
          <div className="resize-ruler" aria-hidden="true">
            {[BREAKPOINT_COMPACT_MAX, BREAKPOINT_MEDIUM_MAX]
              .filter((mark) => mark < range.max)
              .map((mark) => (
                // The chart's box starts one border-width in from the track's edge.
                <span key={mark} className="resize-mark" style={{ left: `${mark + 1}px` }}>
                  {mark}
                </span>
              ))}
          </div>
        )}
        <div
          className="resize-frame"
          data-resize-frame
          data-dragging={dragging || undefined}
          style={width === null ? undefined : { width: `${width}px` }}
        >
          <LiveChart spec={responsiveSpec} className="resize-chart">
            {children}
          </LiveChart>
          {range === null || width === null ? null : (
            <div
              role="slider"
              tabIndex={0}
              aria-label="Chart width"
              aria-orientation="horizontal"
              aria-valuemin={range.min}
              aria-valuemax={range.max}
              aria-valuenow={width}
              aria-valuetext={`${width} px, ${breakpoint} layout`}
              className="resize-handle"
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
            />
          )}
        </div>
      </div>
    </div>
  );
}
