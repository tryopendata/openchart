/**
 * Identifies which landing page elements qualify for analytics and reads their
 * event properties from the DOM.
 */
import type { EventProps } from "../lib/events";

/** Returns the id of the nearest landing section, or null if there is none. */
export function sectionOf(element: Element): string | null {
  return element.closest("[data-landing-section]")?.id || null;
}

/**
 * Reads where an install command was copied from. The hero's command sits in a
 * tab panel whose id ends in the package manager; the start section's bench
 * names its manager and framework on the command's wrapper.
 */
export function installCopiedProps(button: Element): EventProps | null {
  const section = sectionOf(button);
  if (!section) return null;
  const bench = button.closest<HTMLElement>("[data-install-manager]");
  if (bench) {
    const { installManager: manager, installFramework: framework } = bench.dataset;
    return manager && framework ? { section, manager, framework } : null;
  }
  if (!button.matches("[data-copy-command]")) return null;
  const manager = button.closest('[role="tabpanel"]')?.id.match(/-install-([a-z0-9]+)$/)?.[1];
  return manager ? { section, manager } : null;
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
 * What a reader presses to use a demo. Links are left out (a docs link has its
 * own event, a source link leaves the page), and so is anything that is only
 * focusable, such as a scrolling code pane. The edit chart's callout is the one
 * control that is drawn by the chart, so it is named by the library's class.
 */
const DEMO_CONTROL =
  'button, input, select, [role="slider"], [role="tab"], [role="button"], [data-edit-chart] .oc-annotation-text';

/**
 * Reads the section of the demo whose control received a press. A demo is an
 * element marked `data-landing-demo` (a figure's body, the vocabulary wall, the
 * agent session), so a press on a caption or on the chart itself is not one.
 */
export function demoInteractedProps(target: Element): { section: string } | null {
  const demo = target.closest(DEMO_CONTROL)?.closest("[data-landing-demo]");
  const section = demo && sectionOf(demo);
  return section ? { section } : null;
}
