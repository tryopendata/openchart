/**
 * Which landing framework tab is selected, with no DOM or React: the tab ids and
 * the mapping from the reader's stored code-tab choice (shared with the docs
 * demo tabs) to a landing tab. The InstallTabs island imports this, so it stays
 * free of the snippet generator, which framework-panels.ts runs at build time.
 */
import type { Framework } from "../../../lib/demo/framework-choice";

/** The wrappers the landing tabs cover, in tab order. The docs' fifth tab, Spec, has no package. */
export const LANDING_FRAMEWORKS = ["react", "vue", "svelte", "vanilla"] as const;

/** One landing tab id. */
export type LandingFramework = (typeof LANDING_FRAMEWORKS)[number];

/** The tab shown when the stored choice is Spec, or nothing is stored. */
export const DEFAULT_LANDING_FRAMEWORK: LandingFramework = "react";

/** True when the value is one of the landing tab ids. */
export function isLandingFramework(value: string | null | undefined): value is LandingFramework {
  return LANDING_FRAMEWORKS.includes(value as LandingFramework);
}

/** The landing tab for the reader's stored code-tab choice: the same wrapper, or React for Spec. */
export function landingTabFor(choice: Framework): LandingFramework {
  return isLandingFramework(choice) ? choice : DEFAULT_LANDING_FRAMEWORK;
}
