/** Write finite SVG numbers rounded to at most two decimal places. */
export function setNumbers<Attribute extends string>(
  element: SVGElement,
  attributes: Record<Attribute, number>,
) {
  for (const name in attributes) {
    if (!Object.hasOwn(attributes, name)) continue;
    const value = attributes[name];
    if (Number.isFinite(value)) element.setAttribute(name, String(Number(value.toFixed(2))));
  }
}
