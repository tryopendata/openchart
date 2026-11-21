/**
 * Loads GSAP and the plugins the landing page uses, and registers them once.
 * The import is dynamic so GSAP is a lazy chunk: a reader who prefers reduced
 * motion never downloads it, and it stays out of the page's up-front budget.
 */
import type { MotionTools } from "./index";

let loading: Promise<MotionTools> | undefined;

async function importAndRegister(): Promise<MotionTools> {
  const [{ gsap }, { ScrollTrigger }, { Flip }, { Draggable }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("gsap/Flip"),
    import("gsap/Draggable"),
  ]);
  gsap.registerPlugin(ScrollTrigger, Flip, Draggable);
  return { gsap, ScrollTrigger, Flip, Draggable };
}

/** GSAP and its plugins, registered; every caller shares one load. */
export function loadMotionTools(): Promise<MotionTools> {
  loading ??= importAndRegister().catch((error: unknown) => {
    // Let a later caller try again rather than inherit a failed load.
    loading = undefined;
    throw error;
  });
  return loading;
}
