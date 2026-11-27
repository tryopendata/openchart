/**
 * The resize frame's scroll progress as React state: the figure's travel
 * through the viewport (0 to 1) while the scroll drives the frame, null while it
 * does not. Null for good with reduced motion or under the follow media query
 * (frame-scroll-trigger.ts), and from the moment `following` turns false: the
 * trigger is torn down then, so the scroll never moves the frame again.
 */
import { type RefObject, useEffect, useState } from "react";
import { useMotionTools } from "../../shared/use-motion-tools";
import { followFrameScroll } from "./frame-scroll-trigger";

/**
 * @param figure The element whose travel through the viewport is measured.
 * @param following False once the reader has taken the handle.
 */
export function useScrollProgress(
  figure: RefObject<HTMLElement | null>,
  following: boolean,
): number | null {
  const tools = useMotionTools("the resize frame");
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    const element = figure.current;
    if (!tools || !following || !element) return;
    const stop = followFrameScroll(tools, element, setProgress);
    return () => {
      stop();
      setProgress(null);
    };
  }, [tools, following, figure]);
  return progress;
}
