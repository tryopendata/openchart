/**
 * The resize frame's link to the scroll, as React state. The trigger
 * (frame-scroll-trigger.ts) reports progress every scroll frame; this hook turns
 * it into the snapped width (frame-scroll.ts) before it reaches state, so the
 * frame re-renders only when the width moves a step, not during the holds.
 * With reduced motion, under the follow media query, and from the moment
 * `following` turns false the link is off and the frame is the reader's.
 */
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useMotionTools } from "../../shared/use-motion-tools";
import { widthAtProgress } from "./frame-scroll";
import { followFrameScroll } from "./frame-scroll-trigger";
import type { WidthRange } from "./frame-width";

/**
 * How long the frame keeps its CSS width transition after the scroll first sets
 * it, so the first step (on a page loaded or restored part-way through the
 * section it can be large) eases. landing-responsive.css runs it for 520ms.
 */
const EASE_IN_MS = 560;

export type ScrollWidth = {
  /** True while the scroll link is on: the scroll will drive the width. */
  live: boolean;
  /** True from the first moment the link was on in this page view: the figure reserves its height then. */
  linked: boolean;
  /**
   * The width the scroll gives the chart's box, or null while the link is off
   * or the reader has not scrolled since it came on. Waiting for a scroll keeps
   * the frame from moving on its own when the link loads, under a reader's
   * pointer or eyes.
   */
  width: number | null;
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
  const [live, setLive] = useState(false);
  const [linked, setLinked] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const progress = useRef<number | null>(null);
  const scrolled = useRef(false);
  const latestRange = useRef(range);

  const applyWidth = useCallback(() => {
    const at = progress.current;
    const within = latestRange.current;
    const ready = at !== null && within !== null && scrolled.current;
    setWidth(ready ? widthAtProgress(at, within) : null);
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
    const onFirstScroll = () => {
      scrolled.current = true;
      applyWidth();
    };
    window.addEventListener("scroll", onFirstScroll, { once: true, passive: true });
    const stop = followFrameScroll(tools, element, (next) => {
      progress.current = next;
      setLive(next !== null);
      if (next !== null) setLinked(true);
      applyWidth();
    });
    return () => {
      window.removeEventListener("scroll", onFirstScroll);
      stop();
      progress.current = null;
      scrolled.current = false;
      applyWidth();
    };
  }, [tools, following, figure, applyWidth]);

  return { live, linked, width, tracking: useEasedIn(width !== null) };
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
