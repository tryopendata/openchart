/** Reconcile compatible SVG scenes without throwing away surviving nodes. */
function identity(element: Element, index: number): string {
  for (const attr of ['data-key', 'data-label-key', 'data-endpoint-key', 'data-tick-value']) {
    const value = element.getAttribute(attr);
    if (value !== null)
      return `${element.tagName}:${attr}:${value}:${element.getAttribute('data-endpoint-side') ?? ''}`;
  }
  return `${element.tagName}:${element.getAttribute('class') ?? ''}:${index}`;
}

/** Uses engine-produced attributes; never measures the DOM during a frame. */
export function reconcileSVG(current: Element, next: Element): void {
  for (const attribute of Array.from(current.attributes)) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of Array.from(next.attributes)) {
    if (current.getAttribute(attribute.name) !== attribute.value) {
      current.setAttribute(attribute.name, attribute.value);
    }
  }
  // SVG text switches between text nodes and tspans when wrapping changes.
  // Reconcile childNodes, not only Element.children, so stale text cannot survive.
  const candidates = new Map(
    Array.from(current.children, (child, index) => [identity(child, index), child]),
  );
  const survivors = new Set<Node>();
  let elementIndex = 0;
  Array.from(next.childNodes).forEach((child, index) => {
    const match =
      child.nodeType === 1 ? candidates.get(identity(child as Element, elementIndex++)) : undefined;
    const node = match ?? child;
    if (match) reconcileSVG(match, child as Element);
    survivors.add(node);
    const at = current.childNodes[index];
    if (at !== node) current.insertBefore(node, at ?? null);
  });
  for (const child of Array.from(current.childNodes)) {
    if (!survivors.has(child)) current.removeChild(child);
  }
}
