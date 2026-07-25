// ---------------------------------------------------------------------------
// Mark DOM index
// ---------------------------------------------------------------------------

/**
 * One-pass index of `[data-key]` mark elements, built once per transition and
 * shared by every tween builder plus `snapToFinal`. Replaces per-key
 * `querySelector` calls, which were O(marks x DOM nodes) and threw a
 * SyntaxError when a data value contained `"` or `\` (keys are raw String(v)
 * from the engine, never escaped).
 *
 * The same key can legitimately appear on different mark types (a rule and its
 * text label both keyed on the category), so class-qualified buckets mirror the
 * class-qualified selectors they replace. Exit ghosts strip `data-key` before
 * they are appended, so the index never sees them.
 */
export interface MarkDomIndex {
  /** First element in document order with this key (querySelector parity). */
  any(key: string): SVGElement | null;
  point(key: string): SVGElement | null; // circle.oc-mark-point
  rule(key: string): SVGElement | null; // .oc-mark-rule
  tick(key: string): SVGElement | null; // .oc-mark-tick
  text(key: string): SVGElement | null; // .oc-mark-text
}

export function buildMarkDomIndex(marksContainer: SVGElement): MarkDomIndex {
  const anyM = new Map<string, SVGElement>();
  const pointM = new Map<string, SVGElement>();
  const ruleM = new Map<string, SVGElement>();
  const tickM = new Map<string, SVGElement>();
  const textM = new Map<string, SVGElement>();
  for (const node of marksContainer.querySelectorAll('[data-key]')) {
    const el = node as SVGElement;
    const key = el.getAttribute('data-key');
    if (!key) continue;
    if (!anyM.has(key)) anyM.set(key, el);
    const cl = el.classList;
    if (el.tagName === 'circle' && cl.contains('oc-mark-point')) {
      if (!pointM.has(key)) pointM.set(key, el);
    } else if (cl.contains('oc-mark-rule')) {
      if (!ruleM.has(key)) ruleM.set(key, el);
    } else if (cl.contains('oc-mark-tick')) {
      if (!tickM.has(key)) tickM.set(key, el);
    } else if (cl.contains('oc-mark-text')) {
      if (!textM.has(key)) textM.set(key, el);
    }
  }
  const g = (m: Map<string, SVGElement>) => (key: string) => m.get(key) ?? null;
  return { any: g(anyM), point: g(pointM), rule: g(ruleM), tick: g(tickM), text: g(textM) };
}
