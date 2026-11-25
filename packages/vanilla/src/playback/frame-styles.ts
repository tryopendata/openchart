/**
 * Style snapshot for detached playback frames. A cloned SVG leaves the page's
 * stylesheets behind, so this reads the computed text and paint styles of one
 * sample element per role class and writes them out as CSS rules for the clone.
 */
import { SVG_NS } from '../renderers/svg-dom';

/** The CSS to inline into a frame clone, and one font probe per family and weight it uses. */
export interface FrameStyleSnapshot {
  css: string;
  fonts: SVGTextElement[];
}

const CLASS_NAMESPACE = 'oc-';
const FRAME_STYLE_PROPERTIES = [
  'fill',
  'stroke',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-variant-numeric',
  'letter-spacing',
  'dominant-baseline',
  'direction',
] as const;
const PAINT_PROPERTIES: ReadonlySet<string> = new Set(['fill', 'stroke', 'opacity']);

/** The library class that names an element's role, e.g. `oc-race-period`. */
function roleClass(element: Element): string | undefined {
  return Array.from(element.classList).find((name) => name.startsWith(CLASS_NAMESPACE));
}

/** The selector for classless text or a line, scoped by its nearest ancestor with a role. */
function scopedSelector(element: Element): string | undefined {
  let group = element.parentElement;
  while (group && !roleClass(group)) group = group.parentElement;
  const groupRole = group && roleClass(group);
  return groupRole ? `.${groupRole} ${element.localName}` : undefined;
}

/** One sample element per selector, in document order: the root, roles, then classless text and lines. */
function collectStyleSamples(source: SVGElement, styleSelectors: string[]): Map<string, Element> {
  const samples = new Map<string, Element>();
  const rootRole = roleClass(source);
  if (rootRole) samples.set(`.${rootRole}`, source);
  if (!styleSelectors.length) return samples;

  const query = styleSelectors.flatMap((selector) => [selector, `${selector} *`]).join(', ');
  for (const element of source.querySelectorAll(query)) {
    const role = roleClass(element);
    const isTextOrLine = element.localName === 'line' || element.localName === 'text';
    const selector = role ? `.${role}` : isTextOrLine ? scopedSelector(element) : undefined;
    if (selector && !samples.has(selector)) samples.set(selector, element);
  }
  return samples;
}

/** The computed declarations a detached frame needs to match the sampled element. */
function frameDeclarations(element: Element, computed: CSSStyleDeclaration): string[] {
  const declarations: string[] = [];
  for (const property of FRAME_STYLE_PROPERTIES) {
    // The caller's draw updates these paint attributes as playback advances.
    if (PAINT_PROPERTIES.has(property) && element.hasAttribute(property)) continue;
    const value = computed.getPropertyValue(property);
    if (property === 'dominant-baseline') {
      // A baseline inherited from renderer markup belongs to that subtree.
      // Applying the y-axis baseline to all axis labels moves the x-axis labels.
      const baseline = element.closest('[dominant-baseline]')?.getAttribute(property) ?? 'auto';
      if (value === baseline) continue;
    }
    if (value) declarations.push(`${property}: ${value};`);
  }
  return declarations;
}

/**
 * Snapshot the computed styles of the live SVG's root and of one element per role class
 * inside `styleSelectors`, as CSS rules, plus a font probe per family and weight they use.
 * Returns an empty snapshot when the SVG's document has no window to compute styles in.
 */
export function snapshotStyles(
  source: SVGElement,
  styleSelectors: string[],
  fallbackFont: string,
): FrameStyleSnapshot {
  const doc = source.ownerDocument;
  const win = doc.defaultView;
  if (!win) return { css: '', fonts: [] };

  const fonts = new Map<string, SVGTextElement>();
  const rules: string[] = [];
  for (const [selector, element] of collectStyleSamples(source, styleSelectors)) {
    const computed = win.getComputedStyle(element);
    const declarations = frameDeclarations(element, computed);
    if (declarations.length) rules.push(`${selector} { ${declarations.join(' ')} }`);

    const family = computed.fontFamily || fallbackFont;
    const weight = computed.fontWeight;
    const key = `${family}:${weight}`;
    if (fonts.has(key)) continue;
    const probe = doc.createElementNS(SVG_NS, 'text');
    probe.style.fontFamily = family;
    probe.style.fontWeight = weight;
    fonts.set(key, probe);
  }
  return { css: rules.join('\n'), fonts: [...fonts.values()] };
}
