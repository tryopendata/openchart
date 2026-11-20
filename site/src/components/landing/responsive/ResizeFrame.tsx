/**
 * The resize frame island: a chart in a frame whose right edge is a handle. The
 * handle is a slider ("Chart width", value in px) moved by dragging (pointer
 * events) or by keys; a ruler above marks where the library switches between
 * its compact, medium and full layouts. The chart re-lays out through its own
 * resize handling; this island only sets the frame's width.
 *
 * Before hydration the frame fills its track and shows the static chart.
 */
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { LiveChart } from "../story/live-chart";
import {
  breakpointFor,
  COMPACT_BELOW,
  clampWidth,
  MEDIUM_BELOW,
  type WidthRange,
  widthAfterKey,
} from "./frame-width";
import { responsiveSource, responsiveSpec } from "./responsive-spec";

/** The narrowest the frame goes: a small phone's chart column. */
const MIN_WIDTH = 280;
/** What the slider reports before the island has measured its track. */
const UNMEASURED_WIDTH = 720;

export type ResizeFrameProps = {
  /** The static SVGs of the chart at full width. */
  children?: ReactNode;
};

/** Follows the track's width, so the slider's maximum is always the room there is. */
function useTrackWidth(track: RefObject<HTMLDivElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    // A zero width means the track is not laid out (hidden, or no layout engine): keep the last real one.
    const measure = () => {
      const measured = Math.floor(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [track]);
  return width;
}

/** The frame, its ruler and readout, and the drag handle. */
export function ResizeFrame({ children }: ResizeFrameProps) {
  const track = useRef<HTMLDivElement>(null);
  const trackWidth = useTrackWidth(track);
  const range: WidthRange = {
    min: Math.min(MIN_WIDTH, trackWidth ?? MIN_WIDTH),
    max: trackWidth ?? UNMEASURED_WIDTH,
  };
  const [chosen, setChosen] = useState<number | null>(null);
  const width = clampWidth(chosen ?? range.max, range);
  const breakpoint = breakpointFor(width);
  const drag = useRef<{ pointer: number; startX: number; startWidth: number } | null>(null);
  // While dragging the frame follows the pointer exactly; keys and track resizes ease.
  const [dragging, setDragging] = useState(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = widthAfterKey(event.key, width, range);
    if (next === null) return;
    event.preventDefault();
    setChosen(next);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startWidth: width };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    setChosen(clampWidth(active.startWidth + event.clientX - active.startX, range));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <figure className="resize-figure">
      <div className="resize-readout">
        <span className="tabular-nums" data-resize-width>
          {width} px
        </span>
        <span className="resize-breakpoint" data-resize-breakpoint aria-live="polite">
          {breakpoint}
        </span>
      </div>
      <div ref={track} className="resize-track">
        <div className="resize-ruler" aria-hidden="true">
          {[COMPACT_BELOW, MEDIUM_BELOW]
            .filter((mark) => mark < range.max)
            .map((mark) => (
              <span key={mark} className="resize-mark" style={{ left: `${mark}px` }}>
                {mark}
              </span>
            ))}
        </div>
        <div
          className="resize-frame"
          data-resize-frame
          data-dragging={dragging || undefined}
          style={trackWidth === null && chosen === null ? undefined : { width: `${width}px` }}
        >
          <LiveChart spec={responsiveSpec} className="resize-chart">
            {children}
          </LiveChart>
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
          />
        </div>
      </div>
      <figcaption className="figure-caption resize-caption">
        Drag the frame's right edge, or focus it and use the arrow keys. Source:{" "}
        <a href={responsiveSource.url}>{responsiveSource.label}</a>.
      </figcaption>
    </figure>
  );
}
