/**
 * GSAP for a React island, through `withMotion`: null until GSAP has loaded,
 * and null for good when the reader prefers reduced motion (or turns it on
 * later, which reverts the matchMedia context and clears the tools).
 */
import { useEffect, useState } from "react";
import { type MotionTools, withMotion } from "../../scripts/motion";

/**
 * GSAP and its plugins once loaded, or null while motion is off or loading.
 *
 * @param label Names the island in the error logged when GSAP fails to load, such as "the hero desk".
 */
export function useMotionTools(label = "an island"): MotionTools | null {
  const [tools, setTools] = useState<MotionTools | null>(null);
  useEffect(() => {
    const setup = (loaded: MotionTools) => {
      setTools(loaded);
      return () => setTools(null);
    };
    // withMotion names the section in its load error by the setup's name.
    Object.defineProperty(setup, "name", { value: label });
    return withMotion(setup);
  }, [label]);
  return tools;
}
