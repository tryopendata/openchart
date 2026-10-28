import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { SVG_NS } from '../renderers/svg-dom';
import { renderStaticSVG } from '../static';
import { GEOMETRY_ATTRIBUTES, roundGeometryValue } from '../static-dom';
import { renderStaticParts } from '../static-render';
import { staticPlatformSpecs } from './__fixtures__/static-platform-specs';

const optionsFor = (name: string, darkMode: 'off' | 'force') => ({
  darkMode,
  idPrefix: name,
  precision: 3,
  width: name === 'legend-notes' ? 330 : 640,
});

describe('static element tree serialization parity', () => {
  for (const [name, spec] of Object.entries(staticPlatformSpecs))
    for (const darkMode of ['off', 'force'] as const)
      it(`${name} ${darkMode}`, () => {
        const win = new Window();
        try {
          const opts = optionsFor(name, darkMode);
          const { svg } = renderStaticParts(spec, opts, {
            svg: (tag) => win.document.createElementNS(SVG_NS, tag) as unknown as SVGElement,
            html: (tag) => win.document.createElement(tag) as unknown as HTMLElement,
            text: (data) => win.document.createTextNode(data) as unknown as Text,
          });
          for (const el of [svg, ...svg.querySelectorAll('*')])
            for (const attr of Array.from(el.attributes))
              if (GEOMETRY_ATTRIBUTES.has(attr.name))
                el.setAttribute(attr.name, roundGeometryValue(attr.value, 3));
          // R10: happy-dom writes U+00A0 as the non-XML entity `&nbsp;`.
          const viaDom = new win.XMLSerializer()
            .serializeToString(svg as never)
            .replaceAll('&nbsp;', ' ');
          const actual = renderStaticSVG(spec, opts);
          const diff = [...actual].findIndex((value, i) => viaDom[i] !== value);
          if (actual !== viaDom)
            throw new Error(
              `First difference ${diff}: dom=${viaDom.slice(Math.max(0, diff - 80), diff + 180)} actual=${actual.slice(Math.max(0, diff - 80), diff + 180)}`,
            );
          expect(actual).toBe(viaDom);
        } finally {
          win.close();
        }
      });
});

/**
 * Transition proof (RFC §7.1, S1): today's output equals rc.2's happy-dom
 * output once the intended changes in §12 are normalized away.
 *
 * `__fixtures__/legacy-rc2/` holds `renderStaticSVG` output from commit 9f6567fa
 * (9.0.0-rc.2's renderer) for `staticPlatformSpecs` with the options in
 * `optionsFor` minus `precision`, rendered under `TZ=UTC` from a built
 * `git worktree` of that commit. The site fixtures in `static-specs.ts` use
 * marks and options rc.2 does not have (errorbar, barlist, frame, description
 * encodings), so their goldens are the contract instead.
 *
 * Normalizations, each tied to a §12 row:
 * - R1: rc.2's chart `<style>` block is dropped; on elements carrying a theme
 *   role class (and on the root and legend text), the role properties are left
 *   to `static-role-styles.test.ts`, which checks them against the cascade.
 * - R2: `data-theme`, the root `id` and the root id scoping of map style blocks
 *   (which also drops the newline between rules).
 * - R3: `tabindex`, `role="button"`, the notes' "Activate" hint and the root's
 *   `role="group"` (set only when note markers are focusable).
 * - R4: rc.2 geometry rounded to three decimals.
 * - R6: `data-mark`, identity attributes and `<title>` on data marks.
 * - R9: light chart renders use rc.2's light palettes through the `theme` option;
 *   light map blocks take rc.2's accent tokens.
 * - R10: `&nbsp;` written as U+00A0.
 * - R11: per-mark `aria-label`.
 * - R13: the root's `xmlns:xlink` declaration.
 */
const RC2_LIGHT_PALETTES = {
  categorical: ['#06b6d4', '#e29e47', '#4170cb', '#b2417f', '#3ca368', '#a584dc'],
  categoricalFill: ['#51bccc', '#dda96b', '#587fc8', '#bf6291', '#62ab7d', '#ae96da'],
};
const ROLE_PROPERTIES = [
  'fill',
  'stroke',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
];
const ROLE_STYLE_PROPERTIES = ['text-transform', 'font-variant-numeric'];
const ROLE_CLASSES = new Set([
  'oc-chrome',
  'oc-eyebrow',
  'oc-title',
  'oc-subtitle',
  'oc-source',
  'oc-byline',
  'oc-footer',
  'oc-brand',
  'oc-eyebrow-dot',
  'oc-metrics',
  'oc-metric-label',
  'oc-metric-value',
  'oc-metric-delta-up',
  'oc-metric-delta-down',
  'oc-metric-secondary',
  'oc-axis-tick-inline',
  'oc-endpoint-labels',
  'oc-endpoint-label',
  'oc-endpoint-value',
  'oc-endpoint-leader',
  'oc-annotation-subtitle',
  'oc-legend',
]);
const styleDeclarations = (el: Element) =>
  (el.getAttribute('style') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
function carriesRole(el: Element, root: Element): boolean {
  if (el === root) return true;
  if (el.tagName === 'text' && el.closest('.oc-legend')) return true;
  return (el.getAttribute('class') ?? '').split(/\s+/).some((name) => ROLE_CLASSES.has(name));
}
function normalizeLegacy(root: Element, chart: boolean): void {
  if (chart) root.querySelector('defs > style')?.remove(); // R1
  if (root.getAttribute('role') === 'group') root.setAttribute('role', 'img'); // R3
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of Array.from(el.attributes))
      if (GEOMETRY_ATTRIBUTES.has(attr.name))
        el.setAttribute(attr.name, roundGeometryValue(attr.value, 3)); // R4
    el.removeAttribute('tabindex'); // R3
    if (el.getAttribute('role') === 'button') el.removeAttribute('role'); // R3
    const label = el.getAttribute('aria-label');
    if (label?.endsWith('. Activate to read the note.'))
      el.setAttribute('aria-label', label.slice(0, -'. Activate to read the note.'.length)); // R3
    if (el.classList.contains('oc-mark')) el.removeAttribute('aria-label'); // R11
  }
}
function normalizeActual(root: Element, legacyRoot: Element, name: string): void {
  root.removeAttribute('data-theme'); // R2
  root.removeAttribute('id'); // R2
  root.removeAttribute('xmlns:xlink'); // R13
  // R2: scoping rewrites each selector list and drops the newline between rules.
  for (const style of [root, legacyRoot].map((svg) => svg.querySelector('defs > style')))
    if (style?.textContent) style.textContent = style.textContent.replace(/\s*\}\s*/g, '}\n');
  const style = root.querySelector('defs > style');
  if (style?.textContent)
    style.textContent = style.textContent.replace(
      new RegExp(`#${name}-oc-root(?: (?!\\{))?`, 'g'),
      '',
    ); // R2
  const legacyNodes = [legacyRoot, ...legacyRoot.querySelectorAll('*')];
  [root, ...root.querySelectorAll('*')].forEach((el, i) => {
    const legacy = legacyNodes[i];
    if (!legacy || legacy.tagName !== el.tagName) return; // the structural comparison reports it
    if (el.hasAttribute('data-mark')) {
      for (const attr of Array.from(el.attributes))
        if (attr.name.startsWith('data-') && !legacy.hasAttribute(attr.name))
          el.removeAttribute(attr.name); // R6
      for (const child of Array.from(el.children)) if (child.tagName === 'title') child.remove(); // R6
    }
    if (!carriesRole(el, root)) return;
    for (const property of ROLE_PROPERTIES) {
      const value = legacy.getAttribute(property);
      if (value === null) el.removeAttribute(property);
      else el.setAttribute(property, value); // R1
    }
    const legacyStyle = styleDeclarations(legacy);
    const kept = styleDeclarations(el).filter(
      (declaration) =>
        legacyStyle.includes(declaration) ||
        !ROLE_STYLE_PROPERTIES.includes(declaration.split(':')[0].trim()),
    );
    if (kept.length) el.setAttribute('style', `${kept.join('; ')};`);
    else el.removeAttribute('style'); // R1
  });
}
describe('static output equals rc.2 after the intended changes', () => {
  for (const [name, spec] of Object.entries(staticPlatformSpecs))
    for (const darkMode of ['off', 'force'] as const)
      it(`${name} ${darkMode}`, () => {
        const chart = name !== 'map' && name !== 'tilemap';
        const parse = (svg: string) =>
          new DOMParser().parseFromString(svg.replaceAll('&nbsp;', ' '), 'image/svg+xml')
            .documentElement; // R10
        const legacy = parse(
          readFileSync(
            path.join(import.meta.dirname, '__fixtures__/legacy-rc2', `${name}-${darkMode}.svg`),
            'utf8',
          ),
        );
        const actual = parse(
          renderStaticSVG(spec, {
            ...optionsFor(name, darkMode),
            // R9; map and tilemap output does not use the categorical palettes.
            theme: darkMode === 'off' && chart ? { colors: RC2_LIGHT_PALETTES } : undefined,
          }),
        );
        normalizeLegacy(legacy, chart);
        normalizeActual(actual, legacy, name);
        if (!chart && darkMode === 'off') {
          // R9: the map block's accent tokens follow the retuned first palette color.
          const [style, legacyStyle] = [actual, legacy].map(
            (svg) => svg.querySelector('defs > style')!,
          );
          for (const token of ['--oc-accent', '--oc-accent-strong']) {
            const pattern = new RegExp(`${token}: [^;]+;`);
            const value = pattern.exec(legacyStyle.textContent ?? '')?.[0];
            if (value) style.textContent = (style.textContent ?? '').replace(pattern, value);
          }
        }
        const serializer = new XMLSerializer();
        expect(serializer.serializeToString(actual)).toBe(serializer.serializeToString(legacy));
      });
});
