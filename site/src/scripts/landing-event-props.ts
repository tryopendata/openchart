/**
 * Identifies which landing page elements qualify for analytics and reads their
 * event properties from the DOM.
 */
import type { EventProps } from "../lib/events";

/** Returns the id of the nearest landing section, or null if there is none. */
export function sectionOf(element: Element): string | null {
  return element.closest("[data-landing-section]")?.id || null;
}

/** Reads the section and package manager for an install command copy button. */
export function installCopiedProps(button: Element): EventProps | null {
  const section = sectionOf(button);
  const panel = button.closest('[role="tabpanel"]');
  const manager = panel?.id.match(/-install-([a-z0-9]+)$/)?.[1];
  return section && manager ? { section, manager } : null;
}

/** Reads the section and path for a link to this site's docs. */
export function docsLinkProps(link: HTMLAnchorElement): EventProps | null {
  const section = sectionOf(link);
  const { origin, pathname } = link;
  if (
    !section ||
    origin !== link.ownerDocument.location?.origin ||
    !pathname.startsWith("/docs/")
  ) {
    return null;
  }
  return { section, href_path: pathname };
}

/**
 * What a reader presses to use a demo: a control, or the chart they drag a
 * callout on. A press on a figure's plain text or plot is not one, so a thumb
 * that lands on a chart to scroll the page is not counted as using it.
 */
const DEMO_CONTROL =
  'button, a[href], input, select, [role="slider"], [role="tab"], [tabindex], [data-edit-chart]';

/** Reads the section of the figure whose control received a press, or null for any other press. */
export function demoInteractedProps(target: Element): { section: string } | null {
  const figure = target.closest(DEMO_CONTROL)?.closest("figure");
  const section = figure && sectionOf(figure);
  return section ? { section } : null;
}
