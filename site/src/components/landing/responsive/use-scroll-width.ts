/**
 * The resize frame's link to the scroll, as React state. The trigger
 * (frame-scroll-trigger.ts) reports progress every scroll frame; this hook turns
 * it into the snapped width (frame-scroll.ts) before it reaches state, so the
 * frame re-renders only when the width moves a step, not during the holds.
 * With reduced motion, under the follow media query, and from the moment
 * `following` turns false the width is null and the frame is the reader's.
 */
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useMotionTools } from "../../shared/use-motion-tools";
import { widthAtProgress } from "./frame-scroll";
import { followFrameScroll } from "./frame-scroll-trigger";
import type { WidthRange } from "./frame-width";

/**
 * How long the frame keeps its CSS width transition after the scroll first takes
 * it: a page loaded or restored part-way through the section eases from full
 * to the scroll's width instead of snapping. landing-responsive.css runs it for 520ms.
 */
const EASE_IN_MS = 560;

export type ScrollWidth = {
  /** The width the scroll gives the chart's box, or null while the scroll does not drive it. */
  width: number | null;
  /** True from the first width the scroll gave in this page view: the figure reserves its height then. */
  linked: boolean;
  /** True once the first width has eased in: from then on the width follows the scroll with no transition. */
  tracking: boolean;
};

/**
 * @param figure The element whose travel through the viewport is measured.
 * @param range The widths the chart's box may take, or null until measured.
 * @param following False once the reader has taken the handle.
 */
export function useScrollWidth(
  figure: RefObject<HTMLElement | null>,
  range: WidthRange | null,
  following: boolean,
): ScrollWidth {
  const tools = useMotionTools("the resize frame");
  const [width, setWidth] = useState<number | null>(null);
  const [linked, setLinked] = useState(false);
  const progress = useRef<number | null>(null);
  const latestRange = useRef(range);

  const applyWidth = useCallback(() => {
    const at = progress.current;
    const within = latestRange.current;
    setWidth(at === null || within === null ? null : widthAtProgress(at, within));
  }, []);

  const min = range?.min;
  const max = range?.max;
  useEffect(() => {
    latestRange.current = min === undefined || max === undefined ? null : { min, max };
    applyWidth();
  }, [min, max, applyWidth]);

  useEffect(() => {
    const element = figure.current;
    if (!tools || !following || !element) return;
    const stop = followFrameScroll(tools, element, (next) => {
      progress.current = next;
      if (next !== null) setLinked(true);
      applyWidth();
    });
    return () => {
      stop();
      progress.current = null;
      applyWidth();
    };
  }, [tools, following, figure, applyWidth]);

  return { width, linked, tracking: useEasedIn(width !== null) };
}

/** True once `active` has held for EASE_IN_MS; false again as soon as it drops. */
function useEasedIn(active: boolean): boolean {
  const [eased, setEased] = useState(false);
  useEffect(() => {
    if (!active) {
      setEased(false);
      return;
    }
    const timer = setTimeout(() => setEased(true), EASE_IN_MS);
    return () => clearTimeout(timer);
  }, [active]);
  return eased;
}
