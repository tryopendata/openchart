/**
 * Drops type settings a static SVG repeats on every text element when its root
 * already sets them. The library's static renderer writes the chart's font
 * family on the root `<svg>` (a chart as an attribute, a map as the
 * `--oc-font-family` property its own rules read) and again on each `<text>`,
 * and marks each text `font-variant="tabular-nums"` under a root that sets
 * `font-variant-numeric: tabular-nums`. Both inherit, so the copies only add
 * weight: on the landing page they were some 80 KB of HTML. The picture does
 * not change: a copy is removed only when it names exactly the root's family,
 * and an SVG that sets any other family anywhere is left as it is, so no
 * element can inherit a family an ancestor sets differently. A map's root gets
 * the family as an attribute, which is what its text inherited from the page.
 */

const ROOT_TAG = /^<svg\b[^>]*>/;
const FAMILY_ATTRIBUTE = /\sfont-family="([^"]*)"/;
const FAMILY_PROPERTY = /--oc-font-family:\s*((?:&quot;|[^;"])*)/;
const FAMILY_VARIABLE = "var(--oc-font-family)";
/** A font-family attribute or declaration; the lookbehind skips `--oc-font-family`. */
const ANY_FAMILY = /(?<![-\w])font-family(?:="([^"]*)"|:\s*((?:&quot;|[^;"])*))/g;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The markup with the text elements' repeats of the root's family and tabular figures removed. */
export function dropInheritedType(svg: string): string {
  let root = ROOT_TAG.exec(svg)?.[0];
  if (!root) return svg;
  let body = svg.slice(root.length);
  const attribute = FAMILY_ATTRIBUTE.exec(root)?.[1];
  const property = FAMILY_PROPERTY.exec(root)?.[1]?.trim();
  const family = attribute ?? property;
  if (family && everyFamilyIs(body, family, property === family)) {
    const value = escapeRegExp(family);
    if (!attribute) root = root.replace(/>$/, ` font-family="${family}">`);
    body = body
      .replace(new RegExp(`\\sfont-family="${value}"`, "g"), "")
      .replace(new RegExp(`(?<![-\\w])\\s?font-family:\\s*${value};?`, "g"), "")
      .replace(/\sstyle="\s*"/g, "");
  }
  if (/font-variant-numeric:\s*tabular-nums/.test(root)) {
    body = body.replace(/\sfont-variant="tabular-nums"/g, "");
  }
  return root + body;
}

/**
 * True when every font-family the markup declares, as an attribute or in a
 * style, is `family`, or (when `variableIsFamily`) the `--oc-font-family`
 * property the root sets to it.
 */
function everyFamilyIs(markup: string, family: string, variableIsFamily: boolean): boolean {
  for (const [, attribute, declaration] of markup.matchAll(ANY_FAMILY)) {
    const declared = (attribute ?? declaration ?? "").trim();
    if (declared === family || (variableIsFamily && declared === FAMILY_VARIABLE)) continue;
    return false;
  }
  return true;
}
