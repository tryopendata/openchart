/**
 * The reader's choice of code tab (Spec, React, Vue, Svelte or Vanilla), kept in
 * localStorage so it carries across pages. No DOM here: the docs script and the
 * landing page's framework tabs both read and write the choice through this.
 */

/** The localStorage key holding the chosen tab id. */
export const FRAMEWORK_STORAGE_KEY = "openchart:framework";

/** The code tab ids, in the order the tabs appear. */
export const FRAMEWORKS = ["spec", "react", "vue", "svelte", "vanilla"] as const;

/** One code tab id. */
export type Framework = (typeof FRAMEWORKS)[number];

/** The tab shown before the reader has chosen one. */
export const DEFAULT_FRAMEWORK: Framework = "spec";

/** True when the value is one of the five tab ids. */
export function isFramework(value: string | null | undefined): value is Framework {
  return FRAMEWORKS.includes(value as Framework);
}

/** The stored choice, or the default when nothing valid is stored or storage is blocked. */
export function readFrameworkChoice(): Framework {
  try {
    const stored = globalThis.localStorage.getItem(FRAMEWORK_STORAGE_KEY);
    return isFramework(stored) ? stored : DEFAULT_FRAMEWORK;
  } catch {
    // Storage can be blocked (privacy settings, sandboxed frames); the default tab is fine then.
    return DEFAULT_FRAMEWORK;
  }
}

/** Stores the choice. When storage is blocked the choice lasts only for the current page. */
export function writeFrameworkChoice(framework: Framework): void {
  try {
    globalThis.localStorage.setItem(FRAMEWORK_STORAGE_KEY, framework);
  } catch {
    // Blocked storage only means the choice is not remembered across pages.
  }
}
