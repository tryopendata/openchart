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
 * Where the page is wide and motion is allowed, the scroll drives the width
 * first: the frame narrows from full to the narrowest as its figure travels up
 * the viewport (use-scroll-width.ts), and widens again on the way back. The
 * first width key, or a sideways drag, on the handle hands the width to the
 * reader for the rest of the page view; focusing the handle does not. The
 * slider's value always tells the truth, but the breakpoint label is announced
 * only for changes the reader makes.
 *
 * Server render and before hydration: the chart at its natural width, with no
 * slider, readout or ruler, so no reader meets a control that cannot work.
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
import { LiveChart } from "../../shared/LiveChart";
import {
  breakpointFor,
  COMPACT_BELOW,
  clampWidth,
  MEDIUM_UP_TO,
  type WidthRange,
  widthAfterKey,
} from "./frame-width";
import { responsiveSpec } from "./responsive-spec";
import { useScrollWidth } from "./use-scroll-width";

/** The narrowest the chart goes: a small phone's chart column. */
const MIN_WIDTH = 280;
/** Room a breakpoint guide's label needs to the right of its line; nearer the track's end, the guide is left out. */
const GUIDE_LABEL_PX = 40;
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

/** How far a pointer must move sideways on the handle before it counts as a drag. */
const DRAG_START_PX = 4;

const HANDLE_HINT = "Drag the frame's right edge, or focus it and use the arrow keys.";
const FOLLOW_HINT =
  "The frame follows your scroll until you drag its right edge or use the arrow keys on it.";

/**
 * The chart's box width: the reader's choice once they have one, else the
 * scroll's while it drives the frame, else the full width.
 */
function frameWidth(range: WidthRange, chosen: number | null, scrolled: number | null): number {
  return clampWidth(chosen ?? scrolled ?? range.max, range);
}

/** The frame, its ruler and readout, and the drag handle. */
export function ResizeFrame({ children }: ResizeFrameProps) {
  const figure = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const available = useAvailableWidth(track);
  // The reader's first width (a key, or a drag past DRAG_START_PX) ends the scroll's control for this page view.
  const [chosen, setChosen] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);

  const range: WidthRange | null =
    available === null ? null : { min: Math.min(MIN_WIDTH, available), max: available };
  const scroll = useScrollWidth(figure, range, chosen === null);
  const following = scroll.live;
  const width = range === null ? null : frameWidth(range, chosen, scroll.width);

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
    const moved = event.clientX - active.startX;
    // A click, or a touch that starts on the handle and goes up or down, leaves the scroll in charge.
    if (chosen === null && Math.abs(moved) < DRAG_START_PX) return;
    setChosen(clampWidth(active.startWidth + moved, range));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const breakpoint = width === null ? null : breakpointFor(width);
  return (
    <div ref={figure} className="resize-figure" data-scroll-linked={scroll.linked || undefined}>
      {width !== null && breakpoint !== null ? (
        <p className="resize-readout">
          <span className="resize-width tabular-nums" data-resize-width>
            {width} pixels wide
          </span>
          {/* Only the reader's own changes are announced, not the ones the scroll makes. */}
          <span
            className="resize-breakpoint"
            data-resize-breakpoint
            aria-live={following ? undefined : "polite"}
          >
            {breakpoint}
          </span>
          <span className="resize-hint" data-resize-hint>
            {following ? FOLLOW_HINT : HANDLE_HINT}
          </span>
        </p>
      ) : null}
      <div ref={track} className="resize-track" data-measured={range === null ? undefined : ""}>
        {range === null ? null : (
          <div className="resize-ruler" aria-hidden="true">
            {[COMPACT_BELOW, MEDIUM_UP_TO]
              .filter((mark) => mark + GUIDE_LABEL_PX <= range.max)
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
          data-following={scroll.tracking || undefined}
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
