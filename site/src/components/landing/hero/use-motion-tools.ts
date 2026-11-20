/**
 * GSAP for a React island, through `withMotion`: null until GSAP has loaded,
 * and null for good when the reader prefers reduced motion (or turns it on
 * later, which reverts the matchMedia context and clears the tools).
 */
import { useEffect, useState } from "react";
import { type MotionTools, withMotion } from "../../../scripts/motion";

/** GSAP and its plugins once loaded, or null while motion is off or loading. */
export function useMotionTools(): MotionTools | null {
  const [tools, setTools] = useState<MotionTools | null>(null);
  useEffect(
    () =>
      withMotion(function heroDesk(loaded) {
        setTools(loaded);
        return () => setTools(null);
      }),
    [],
  );
  return tools;
}
