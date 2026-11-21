/**
 * Slims a static SVG: drops the data attributes and ids only a live chart
 * reads. A static SVG is a picture the live chart replaces; the library writes
 * mark keys, series names and indexes on it for hit testing and transitions,
 * which in a picture are only weight. Whole-pixel geometry is the renderer's job.
 */
import { DEMO_ATTR } from "./markup";

/** Data attributes the slimmed SVGs keep: CSS picks a theme by one, demos.ts removes the placeholder by the other. */
const KEPT_DATA_ATTRIBUTES = new Set(["data-theme", DEMO_ATTR.placeholder]);

/**
 * The markup without `data-*` attributes (except those in KEPT_DATA_ATTRIBUTES)
 * and without ids nothing in it references. Ids that a `url(#…)`, `href="#…"`
 * or an ARIA reference points at, such as clip paths, gradients and titles,
 * stay, and so do ids a `<style>` block selects.
 */
export function slimSvg(svg: string): string {
  const referenced = new Set([
    ...[...svg.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map(([, id]) => id ?? ""),
    ...[...svg.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap(([, ids]) =>
      (ids ?? "").split(/\s+/),
    ),
    // A map's <style> scopes its rules to the root's id (`svg.oc-map#t-oc-root .oc-title`).
    ...[...svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].flatMap(([, css]) =>
      [...(css ?? "").matchAll(/#([A-Za-z][\w-]*)/g)].map(([, id]) => id ?? ""),
    ),
  ]);
  return svg
    .replace(/\s(data-[\w-]+)(?:="[^"]*")?(?=[\s>/])/g, (attribute, name: string) =>
      KEPT_DATA_ATTRIBUTES.has(name) ? attribute : "",
    )
    .replace(/\sid="([^"]*)"/g, (attribute, id: string) => (referenced.has(id) ? attribute : ""));
}
