/**
 * What each landing event says about where it happened. Pure functions of the
 * DOM, so landing-events.ts only listens and sends. Lane 3c fills this in.
 */

/** The id of the landing section an element is in, or null outside one. */
export function sectionOf(_element: Element): string | null {
  throw new Error("sectionOf is not implemented.");
}
