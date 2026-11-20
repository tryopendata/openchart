/**
 * Choreography table: every entrance role, its keyframe, curve, durations and
 * delay rule, in one place.
 *
 * `scripts/generate-motion-css.mjs` emits `styles/keyframes.css`,
 * `styles/animation.css` and `styles/table-animation.css` from KEYFRAMES and
 * ENTRANCE_ROLES. GIF export, the canvas entrance and the cleanup timer read
 * the same data through `entranceTiming`, `entranceEndMs`, `evalRoleEase` and
 * `evalKeyframes`, so the CSS and the JS paths cannot drift.
 *
 * Delays keyed to a parent's tween are progress points ("when the parent
 * reaches p"), resolved through the parent's actual curve for the phase
 * (`invertRoleEase`), never a raw fraction of the duration. CSS can't invert a
 * curve, so renderers stamp the resolved offsets (`entranceAnchorVars`); the
 * generated CSS falls back to the default `smooth` resolution.
 */

import {
  type CurveName,
  evalCubicBezier,
  evalCurve,
  invertCurve,
  isMonotoneCurve,
  type MonotoneCurveName,
} from './curves';
import type { MotionPhase } from './sample';
import { sampleMotion } from './sample';
import { MAP_POINT_STAGGER_FALLBACK_MS, MAP_SWEEP_BUDGET_MS, mapFeatureDuration } from './stagger';

export { evalCubicBezier } from './curves';

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

export type KeyframeProperty =
  | 'opacity'
  | 'clip-path'
  | 'transform'
  | 'fill'
  | 'r'
  | 'fill-opacity';

export type KeyframeValue =
  | { type: 'number'; value: number }
  /** clip-path: inset(top right bottom left), each in percent. */
  | { type: 'inset'; top: number; right: number; bottom: number; left: number }
  | { type: 'translateY'; value: number; unit: 'px' | 'em' }
  | { type: 'translate'; x: number; y: number }
  | { type: 'scale'; value: number }
  /** A value JS cannot interpolate (custom properties); switches discretely. */
  | { type: 'css'; css: string };

export interface KeyframeStop {
  /** Offset in [0, 1] (0 = from, 1 = to). */
  offset: number;
  values: Readonly<Partial<Record<KeyframeProperty, KeyframeValue>>>;
}

export interface KeyframeDef {
  comment: string;
  stops: readonly KeyframeStop[];
}

const num = (value: number): KeyframeValue => ({ type: 'number', value });
const inset = (top: number, right: number, bottom: number, left: number): KeyframeValue => ({
  type: 'inset',
  top,
  right,
  bottom,
  left,
});
const translateY = (value: number, unit: 'px' | 'em' = 'px'): KeyframeValue => ({
  type: 'translateY',
  value,
  unit,
});
const translate = (x: number, y: number): KeyframeValue => ({ type: 'translate', x, y });
const scale = (value: number): KeyframeValue => ({ type: 'scale', value });
const css = (value: string): KeyframeValue => ({ type: 'css', css: value });

/** Every @keyframes in styles/keyframes.css, in emission order. */
export const KEYFRAMES = {
  'oc-enter-bar': {
    comment:
      'Bar entrance: clip-path reveal from the baseline (vertical columns), no fade:\na value mark is solid from its first frame. Grows bottom-to-top unless the\nrenderer stamps --oc-bar-from (a negative column grows top-to-bottom).',
    stops: [
      { offset: 0, values: { 'clip-path': css('inset(var(--oc-bar-from, 100% 0 0 0))') } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0) } },
    ],
  },
  'oc-enter-bar-h': {
    comment:
      'Bar entrance: clip-path reveal from the baseline (horizontal bars), no fade.\nGrows left-to-right unless --oc-bar-from is stamped (negative bars).',
    stops: [
      { offset: 0, values: { 'clip-path': css('inset(var(--oc-bar-from, 0 100% 0 0))') } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0) } },
    ],
  },
  'oc-enter-stack': {
    comment:
      'Stack entrance: one clip over the whole stack, no fade. Grows bottom-to-top\nfrom --oc-stack-from, which the renderer stamps when the baseline is not the\nbottom edge, so the clip starts collapsed on the baseline and grows both\nways from it.',
    stops: [
      { offset: 0, values: { 'clip-path': css('inset(var(--oc-stack-from, 100% 0 0 0))') } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0) } },
    ],
  },
  'oc-enter-stack-h': {
    comment:
      'Horizontal stack entrance: grows left-to-right, or both ways from the\nbaseline when --oc-stack-from is stamped.',
    stops: [
      { offset: 0, values: { 'clip-path': css('inset(var(--oc-stack-from, 0 100% 0 0))') } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0) } },
    ],
  },
  'oc-enter-line': {
    comment:
      'Line/area entrance: clip-path reveal left-to-right + fade in.\nLines draw in following reading direction with a soft lead-in.',
    stops: [
      { offset: 0, values: { 'clip-path': inset(0, 100, 0, 0), opacity: num(0) } },
      { offset: 0.15, values: { opacity: num(1) } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0), opacity: num(1) } },
    ],
  },
  'oc-enter-point': {
    comment: 'Point/arc entrance: scale up + fade in from center',
    stops: [
      { offset: 0, values: { opacity: num(0), transform: scale(0.3) } },
      { offset: 1, values: { opacity: num(1), transform: scale(1) } },
    ],
  },
  'oc-enter-map-fill': {
    comment:
      'Map feature entrance: fade in while transitioning fill from a neutral base\nto the data-driven color stored in --oc-feature-fill. The target opacity is\n--oc-feature-target-opacity (default 1) so features under a focus dim\nanimate straight to their dimmed rest opacity instead of hitting 1 and then\nsnapping down when the dim is applied post-animation.\nNon-interpolable fills (the url(#pattern) hatch on no-data features) do not\ntransition: the browser holds the neutral and flips to the pattern when the\neased progress passes 50%, so those features fade in rather than\ncross-fade.',
    stops: [
      { offset: 0, values: { fill: css('var(--oc-secondary)'), opacity: num(0) } },
      {
        offset: 1,
        values: {
          fill: css('var(--oc-feature-fill)'),
          opacity: css('var(--oc-feature-target-opacity, 1)'),
        },
      },
    ],
  },
  'oc-enter-map-point': {
    comment:
      "Map point pop-in: gentle scale from 0.75 + fade. Uses transform-origin to\nscale from the circle's own center (cx/cy) rather than the SVG origin.",
    stops: [
      { offset: 0, values: { opacity: num(0), transform: scale(0.75) } },
      { offset: 1, values: { opacity: num(1), transform: scale(1) } },
    ],
  },
  'oc-enter-fade-only': {
    comment:
      'Pure opacity fade (no transform). Safe for elements with existing transforms\nlike arc groups that use translate() for positioning.',
    stops: [
      { offset: 0, values: { opacity: num(0) } },
      { offset: 1, values: { opacity: num(1) } },
    ],
  },
  'oc-enter-fade': {
    comment: 'Fade + subtle slide up (table chrome)',
    stops: [
      { offset: 0, values: { opacity: num(0), transform: translateY(4) } },
      { offset: 1, values: { opacity: num(1), transform: translateY(0) } },
    ],
  },
  'oc-enter-rise': {
    comment: 'Text rise: 0.6em up to rest. Its opacity runs as a separate quick fade.',
    stops: [
      { offset: 0, values: { transform: translateY(0.6, 'em') } },
      { offset: 1, values: { transform: translateY(0) } },
    ],
  },
  'oc-enter-slide': {
    comment: 'Row slide: 4px up to rest. Its opacity runs as a separate quick fade.',
    stops: [
      { offset: 0, values: { transform: translateY(4) } },
      { offset: 1, values: { transform: translateY(0) } },
    ],
  },
  'oc-table-enter-row': {
    comment:
      'Table row entrance: slide up only, no opacity (cells fade independently\nto avoid opacity compounding between row and cell animations)',
    stops: [
      { offset: 0, values: { transform: translateY(6) } },
      { offset: 1, values: { transform: translateY(0) } },
    ],
  },
  'oc-table-enter-bar-fill': {
    comment:
      'Table bar fill entrance: clip-path grow only, no opacity\n(preserves resting opacity: 0.15 from table.css)',
    stops: [
      { offset: 0, values: { 'clip-path': inset(0, 100, 0, 0) } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0) } },
    ],
  },
  'oc-pulse': {
    comment:
      'Live-tile pulse: the terminator dot of a sparkline swells once when new\ndata lands, so a glance at a wall of tiles catches which one just moved.\n`r` is animated as a presentation attribute (SVG geometry properties are\nanimatable in CSS); the fallback is simply no swell.',
    stops: [
      { offset: 0, values: { r: css('var(--oc-pulse-r, 4px)'), 'fill-opacity': num(1) } },
      {
        offset: 0.45,
        values: { r: css('calc(var(--oc-pulse-r, 4px) * 1.8)'), 'fill-opacity': num(0.5) },
      },
      { offset: 1, values: { r: css('var(--oc-pulse-r, 4px)'), 'fill-opacity': num(1) } },
    ],
  },
  'oc-tooltip-in': {
    comment: 'Tooltip entrance',
    stops: [
      { offset: 0, values: { opacity: num(0), transform: translateY(2) } },
      { offset: 1, values: { opacity: num(1), transform: translateY(0) } },
    ],
  },
} as const satisfies Record<string, KeyframeDef>;

export type KeyframeName = keyof typeof KEYFRAMES;

function pct(v: number): string {
  return v === 0 ? '0' : `${v}%`;
}

/** Serialize a keyframe value as CSS. */
export function keyframeValueToCSS(value: KeyframeValue): string {
  switch (value.type) {
    case 'number':
      return String(value.value);
    case 'inset':
      return `inset(${pct(value.top)} ${pct(value.right)} ${pct(value.bottom)} ${pct(value.left)})`;
    case 'translateY':
      return value.value === 0 ? 'translateY(0)' : `translateY(${value.value}${value.unit})`;
    case 'translate':
      return `translate(${value.x}px, ${value.y}px)`;
    case 'scale':
      return `scale(${value.value})`;
    case 'css':
      return value.css;
    default:
      return value satisfies never;
  }
}

function lerp(a: number, b: number, e: number): number {
  return a + (b - a) * e;
}

function interpolateValue(a: KeyframeValue, b: KeyframeValue, e: number): KeyframeValue {
  if (a.type === 'number' && b.type === 'number') return num(lerp(a.value, b.value, e));
  if (a.type === 'inset' && b.type === 'inset') {
    return inset(
      lerp(a.top, b.top, e),
      lerp(a.right, b.right, e),
      lerp(a.bottom, b.bottom, e),
      lerp(a.left, b.left, e),
    );
  }
  if (a.type === 'translateY' && b.type === 'translateY') {
    // A unitless 0 end takes the other end's unit.
    const unit = a.value === 0 ? b.unit : a.unit;
    return translateY(lerp(a.value, b.value, e), unit);
  }
  if (a.type === 'translate' && b.type === 'translate') {
    return translate(lerp(a.x, b.x, e), lerp(a.y, b.y, e));
  }
  if (a.type === 'scale' && b.type === 'scale') return scale(lerp(a.value, b.value, e));
  // Non-interpolable pairs flip at the eased midpoint, as the browser does.
  return e < 0.5 ? a : b;
}

/**
 * Evaluate a keyframe at time progress t in [0, 1], CSS-style: each property
 * interpolates between the stops that specify it, and `ease` is applied within
 * each such segment (the animation-timing-function applies per keyframe
 * segment, not across the whole animation).
 */
export function evalKeyframes(
  name: KeyframeName,
  t: number,
  ease: (progress: number) => number,
): Partial<Record<KeyframeProperty, KeyframeValue>> {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  const stops: readonly KeyframeStop[] = KEYFRAMES[name].stops;
  const out: Partial<Record<KeyframeProperty, KeyframeValue>> = {};
  for (const prop of keyframeProperties(name)) {
    const own = stops.filter((s) => s.values[prop] !== undefined);
    let i = 0;
    while (i < own.length - 2 && own[i + 1].offset <= x) i++;
    const a = own[i];
    const b = own[i + 1] ?? a;
    const span = b.offset - a.offset;
    const local = span > 0 ? Math.min(1, Math.max(0, (x - a.offset) / span)) : 1;
    out[prop] = interpolateValue(a.values[prop]!, b.values[prop]!, ease(local));
  }
  return out;
}

/** Properties a keyframe animates, in first-seen order. */
export function keyframeProperties(name: KeyframeName): KeyframeProperty[] {
  const seen: KeyframeProperty[] = [];
  for (const stop of KEYFRAMES[name].stops as readonly KeyframeStop[]) {
    for (const prop of Object.keys(stop.values) as KeyframeProperty[]) {
      if (!seen.includes(prop)) seen.push(prop);
    }
  }
  return seen;
}

/**
 * Offset at which the given properties stop changing (0 when none animate).
 * oc-enter-line's opacity settles at 0.15; its clip-path at 1.
 */
function settleOffset(name: KeyframeName, props: KeyframeProperty[]): number {
  let end = 0;
  const stops: readonly KeyframeStop[] = KEYFRAMES[name].stops;
  for (const prop of props) {
    const own = stops.filter((s) => s.values[prop] !== undefined);
    for (let i = 1; i < own.length; i++) {
      const changed =
        keyframeValueToCSS(own[i].values[prop]!) !== keyframeValueToCSS(own[i - 1].values[prop]!);
      if (changed) end = Math.max(end, own[i].offset);
    }
  }
  return end;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type EntranceRole =
  | 'bar'
  | 'bar-h'
  | 'cell'
  | 'stack-reveal'
  | 'stack-reveal-h'
  | 'line-area'
  | 'arc'
  | 'point'
  | 'line-point'
  | 'text'
  | 'rule'
  | 'tick'
  | 'label'
  | 'endpoint-label'
  | 'annotation'
  | 'tilemap-tile'
  | 'map-feature'
  | 'map-bulk'
  | 'map-border'
  | 'map-point'
  | 'sankey-node'
  | 'sankey-link'
  | 'barlist-row'
  | 'barlist-bar'
  | 'table-chrome'
  | 'table-thead'
  | 'table-row'
  | 'table-cell'
  | 'table-heatmap-cell'
  | 'table-bar-fill'
  | 'table-sparkline'
  | 'table-sparkline-dot'
  | 'table-search-pagination';

/** The easing a role's CSS uses. */
export type RoleTiming =
  /** The author's ease: `var(--oc-animation-ease, var(--oc-ease-smooth))` (spring-aware). */
  | { kind: 'author' }
  /** A registry curve regardless of the author's ease (annotations). */
  | { kind: 'curve'; curve: CurveName }
  /** A fixed CSS timing function, with its cubic-bezier control points for JS. */
  | { kind: 'css'; css: string; bezier: readonly [number, number, number, number] };

/** Animation duration of a role, from the base duration D. */
export type DurationRule = { kind: 'base'; factor: number } | { kind: 'fixed'; ms: number };

/**
 * When a role starts, relative to something else's tween. Never a raw
 * fraction of the duration: a progress point is resolved through the
 * parent's actual curve, so it means "when the parent has visibly got there"
 * whichever ease the author picked.
 */
export type DelayAnchor =
  /**
   * When the parent role's tween reaches `progress`. The parent is taken at
   * index 0 (its stagger is the child's own), or at the context's
   * `lastMarkIndex` with `ofLast` (annotations wait for the last mark).
   */
  | { kind: 'progress'; progress: number; of: EntranceRole; ofLast?: boolean }
  /** A progress point of the map feature sweep: `progress * MAP_SWEEP_BUDGET_MS`. */
  | { kind: 'sweep'; progress: number };

/** How entering elements of a role are spread out by index. */
export type StaggerRule =
  | 'none'
  /** `index * --oc-animation-stagger`, index from `--oc-mark-index`. */
  | 'mark'
  /** `index * --oc-animation-stagger`, index from `--oc-row-index` (tables). */
  | 'row'
  /** `index * --oc-point-stagger` (60ms fallback); the map stamps clampStaggerDelay. */
  | 'map-point'
  /** Stamped `--oc-map-delay`; JS: shuffled slot index * map stagger (mapSweepTiming). */
  | 'map-sweep'
  /** Stamped `--oc-tile-delay`; JS: the context's delayMs (tilemapTileDelays). */
  | 'tilemap-tile';

export interface DelayRule {
  /** Start at this anchor (omitted = at once), then add the stagger. */
  after?: DelayAnchor;
  /** Add `--oc-annotation-delay` (150ms fallback) on top. */
  plusAnnotationDelay?: boolean;
  stagger: StaggerRule;
}

export interface EntranceRoleDef {
  name: EntranceRole;
  /** Which generated stylesheet and root selector the rule lives under. */
  scope: 'chart' | 'table';
  /** Selectors relative to the scope root. */
  selectors: readonly string[];
  /**
   * Which declarations the CSS rule writes. `shorthand` writes the full
   * `animation` shorthand plus delay; a list writes only those longhands and
   * inherits the rest from an earlier, less specific role.
   */
  emit: 'shorthand' | readonly ('name' | 'duration' | 'timing' | 'delay')[];
  keyframe: KeyframeName;
  /** Bar-family roles play this keyframe when their group is horizontal. */
  horizontalKeyframe?: KeyframeName;
  timing: RoleTiming;
  /** What D is: the phase duration, or the map's capped feature duration. */
  durationBasis: 'phase' | 'map';
  duration: DurationRule;
  /**
   * A second, quick opacity animation on the same element and delay
   * (`oc-enter-fade-only` over `ms` on FADE_CURVE), so text is readable almost
   * at once while its geometry keeps settling. Needs `emit: 'shorthand'`.
   */
  fade?: { ms: number };
  delay: DelayRule;
  /** Descendant selectors whose own animation this role switches off. */
  suppress?: readonly string[];
  /** Accent roles (annotation markers and the like) may use overshooting curves such as `punch`. */
  accent?: boolean;
  comment?: string;
}

/** A role row with its derived fields. */
export interface EntranceRoleRow extends EntranceRoleDef {
  /** Share of the duration over which non-opacity properties move (0 if none). */
  geometryFraction: number;
  /** Share of the duration after which the keyframe's own opacity has settled (0 if none). */
  opacityFraction: number;
  /**
   * Role-scoped custom properties the generated CSS reads first: a full
   * per-element delay, a duration, and the root-stamped anchor offset
   * (`after`) that the anchor resolves to for this render's curve.
   */
  vars: { delay: string; duration: string; after: string };
}

/** Curve of the quick opacity track on roles with `fade`. */
export const FADE_CURVE: CurveName = 'snap';

/** The quick fade text and labels share: opaque well before their geometry settles. */
const TEXT_FADE_MS = 140;
/** Data labels fade in place after their mark lands. */
const LABEL_FADE_MS = 260;
/** Points and arcs: their only entrance is opacity. */
const POINT_FADE_MS = 300;

const AUTHOR: RoleTiming = { kind: 'author' };
const EASE_IN: RoleTiming = { kind: 'css', css: 'ease-in', bezier: [0.42, 0, 1, 1] };
const base = (factor: number): DurationRule => ({ kind: 'base', factor });
const fixed = (ms: number): DurationRule => ({ kind: 'fixed', ms });
const when = (of: EntranceRole, progress: number): DelayAnchor => ({
  kind: 'progress',
  progress,
  of,
});

const ROLE_DEFS: readonly EntranceRoleDef[] = [
  {
    name: 'bar',
    scope: 'chart',
    comment:
      'Vertical bars (default): the author curve over the full duration, no fade.\noc-mark-bar is reserved for future mark type aliases.\nA bar with a value-end radius draws as <path> rather than <rect>\n(SVG rx rounds all four corners or none), so both shapes match.',
    selectors: ['.oc-mark-rect :is(rect, path)', '.oc-mark-bar :is(rect, path)'],
    emit: 'shorthand',
    keyframe: 'oc-enter-bar',
    horizontalKeyframe: 'oc-enter-bar-h',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'bar-h',
    scope: 'chart',
    comment: 'Horizontal bars (data-orient is on the mark group, not the SVG root)',
    selectors: [
      '.oc-mark-rect[data-orient="horizontal"] :is(rect, path)',
      '.oc-mark-bar[data-orient="horizontal"] :is(rect, path)',
    ],
    emit: ['name'],
    keyframe: 'oc-enter-bar-h',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'cell',
    scope: 'chart',
    comment:
      'Grid cells (heatmap, waffle, calendar) have no baseline to grow from:\na quick fade on the author curve, no clip.',
    selectors: ['.oc-mark-rect[data-cell] :is(rect, path)'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: fixed(POINT_FADE_MS),
    delay: { stagger: 'mark' },
  },
  {
    name: 'stack-reveal',
    scope: 'chart',
    comment:
      'Stacked bars reveal as one group per stack, each on its own stagger slot;\ntheir segments do not animate. A stack that crosses zero grows both ways\nfrom the baseline (--oc-stack-from).',
    selectors: ['.oc-stack-reveal'],
    emit: 'shorthand',
    keyframe: 'oc-enter-stack',
    horizontalKeyframe: 'oc-enter-stack-h',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
    suppress: ['.oc-stack-reveal .oc-mark-rect :is(rect, path)'],
  },
  {
    name: 'stack-reveal-h',
    scope: 'chart',
    selectors: ['.oc-stack-reveal[data-orient="horizontal"]'],
    emit: ['name'],
    keyframe: 'oc-enter-stack-h',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'line-area',
    scope: 'chart',
    comment: 'Line and area marks: entire group clips left-to-right + fades in',
    selectors: ['.oc-mark-line', '.oc-mark-area'],
    emit: 'shorthand',
    keyframe: 'oc-enter-line',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'arc',
    scope: 'chart',
    comment:
      'Arc marks (pie/donut slices): a quick fade on the author curve.\nScale transforms break arc positioning because arcs use translate()\non parent groups.',
    selectors: ['.oc-mark-arc'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: fixed(POINT_FADE_MS),
    delay: { stagger: 'mark' },
  },
  {
    name: 'point',
    scope: 'chart',
    comment:
      'Point marks (scatter, dot): a quick fade on the author curve, no scale.\nPoints render as bare <circle> elements with class oc-mark-point directly,\nnot wrapped in a group, so we target circle.oc-mark-point (not descendant).',
    selectors: ['circle.oc-mark-point', 'circle.oc-mark-circle'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: fixed(POINT_FADE_MS),
    delay: { stagger: 'mark' },
  },
  {
    name: 'line-point',
    scope: 'chart',
    comment:
      "Points on line/area charts appear as the line's clip edge reaches them: the\nrenderer stamps each point's delay from its x along its own series.",
    selectors: ['.oc-mark-line ~ circle.oc-mark-point', '.oc-mark-area ~ circle.oc-mark-point'],
    emit: ['duration', 'delay'],
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: fixed(POINT_FADE_MS),
    delay: { after: when('line-area', 0.5), stagger: 'mark' },
  },
  {
    name: 'text',
    scope: 'chart',
    comment: 'Text marks: rise 0.6em on the author curve, with a quick fade',
    selectors: ['.oc-mark-text text'],
    emit: 'shorthand',
    keyframe: 'oc-enter-rise',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    fade: { ms: TEXT_FADE_MS },
    delay: { stagger: 'mark' },
  },
  {
    name: 'rule',
    scope: 'chart',
    comment: 'Rule marks: fade in place, never translate (a moving rule reads a wrong value)',
    selectors: ['.oc-mark-rule line'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.5),
    delay: { stagger: 'mark' },
  },
  {
    name: 'tick',
    scope: 'chart',
    comment: 'Tick marks: fade in place',
    selectors: ['.oc-mark-tick line'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.5),
    delay: { stagger: 'mark' },
  },
  {
    name: 'label',
    scope: 'chart',
    comment:
      "Data labels (bar values, line end labels, pie slice labels) fade in place\nonce their mark has landed: when the bar at the label's --oc-mark-index\nreaches 0.97. Lines and arcs share the bar's duration and curve, so the bar\nanchor stands in for them. Labels never move during the entrance.",
    selectors: ['.oc-mark-label'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: fixed(LABEL_FADE_MS),
    delay: { after: when('bar', 0.97), stagger: 'mark' },
  },
  {
    name: 'endpoint-label',
    scope: 'chart',
    comment:
      "Trailing endpoint labels (marker, name, value) and area interior labels:\nfade in as their own series' line reaches the end, never before it. The\nrenderer stamps each entry with its series' --oc-mark-index.",
    selectors: [
      '.oc-endpoint-label-entry[data-endpoint-side="trailing"]',
      '.oc-area-interior-label',
    ],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: fixed(POINT_FADE_MS),
    delay: { after: when('line-area', 0.95), stagger: 'mark' },
  },
  {
    name: 'annotation',
    scope: 'chart',
    comment: 'Annotations: fade in once the last mark is 90% of the way there',
    selectors: ['.oc-annotation'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: { kind: 'curve', curve: 'glide' },
    durationBasis: 'phase',
    duration: fixed(300),
    delay: {
      after: { kind: 'progress', progress: 0.9, of: 'bar', ofLast: true },
      plusAnnotationDelay: true,
      stagger: 'none',
    },
  },
  {
    name: 'tilemap-tile',
    scope: 'chart',
    comment:
      'Tilemap tiles: fade in with jittered stagger for organic feel.\nPer-tile delay is computed in the renderer with pseudo-random variation.',
    selectors: ['.oc-tilemap-tile'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: EASE_IN,
    durationBasis: 'phase',
    duration: base(0.35),
    delay: { stagger: 'tilemap-tile' },
  },
  {
    name: 'map-feature',
    scope: 'chart',
    comment:
      'Map features: fill color reveal with shuffled stagger.\nPer-feature --oc-map-delay is computed in the renderer via a seeded\nFisher-Yates shuffle so features pop in organically.',
    selectors: ['.oc-map-feature'],
    emit: 'shorthand',
    keyframe: 'oc-enter-map-fill',
    timing: AUTHOR,
    durationBasis: 'map',
    duration: base(1),
    delay: { stagger: 'map-sweep' },
  },
  {
    name: 'map-bulk',
    scope: 'chart',
    comment:
      'Bulk mode: high feature counts (counties, ~3k+) get a single group\nfade instead of per-feature fill animations. opacity is GPU-compositable\nso this stays smooth regardless of child count.',
    selectors: ['.oc-map-features[data-bulk-animate]'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'map',
    duration: base(1),
    delay: { stagger: 'none' },
    suppress: ['.oc-map-features[data-bulk-animate] .oc-map-feature'],
  },
  {
    name: 'map-border',
    scope: 'chart',
    comment: 'Map borders: fade in once most of the feature sweep has started',
    selectors: ['.oc-map-borders path'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: EASE_IN,
    durationBasis: 'map',
    duration: base(0.4),
    delay: { after: { kind: 'sweep', progress: 0.6 }, stagger: 'none' },
  },
  {
    name: 'map-point',
    scope: 'chart',
    comment:
      "Map points: gentle scale (0.75->1) + fade pop-in just after the borders.\ntransform-origin set per-circle in the renderer so scale happens\naround each circle's own center, not the SVG origin.",
    selectors: ['.oc-map-point'],
    emit: 'shorthand',
    keyframe: 'oc-enter-map-point',
    timing: AUTHOR,
    durationBasis: 'map',
    duration: base(0.4),
    delay: { after: { kind: 'sweep', progress: 0.65 }, stagger: 'map-point' },
  },
  {
    name: 'sankey-node',
    scope: 'chart',
    comment: 'Sankey nodes: fade in with stagger by column depth (left-to-right)',
    selectors: ['.oc-sankey-node rect'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'sankey-link',
    scope: 'chart',
    comment:
      "Sankey links: fade in when their source node is halfway in. Each link\ncarries its source node's --oc-mark-index.",
    selectors: ['.oc-sankey-link path'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { after: when('sankey-node', 0.5), stagger: 'mark' },
  },
  {
    name: 'barlist-row',
    scope: 'chart',
    comment: 'Barlist rows: slide up with a quick fade per row; bars grow left-to-right',
    selectors: ['.oc-barlist-row'],
    emit: 'shorthand',
    keyframe: 'oc-enter-slide',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.6),
    fade: { ms: TEXT_FADE_MS },
    delay: { stagger: 'mark' },
  },
  {
    name: 'barlist-bar',
    scope: 'chart',
    selectors: ['.oc-barlist-bar'],
    emit: 'shorthand',
    keyframe: 'oc-enter-bar-h',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'table-chrome',
    scope: 'table',
    comment: 'Chrome (title/subtitle): fade + slide up',
    selectors: ['> .oc-chrome'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.6),
    delay: { stagger: 'none' },
  },
  {
    name: 'table-thead',
    scope: 'table',
    comment: 'Table header: quick fade before rows start',
    selectors: ['thead'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.4),
    delay: { stagger: 'none' },
  },
  {
    name: 'table-row',
    scope: 'table',
    comment:
      'Row entrance: slide up only, no opacity (cells handle their own fading\nto avoid opacity compounding between row and cell animations)',
    selectors: ['tbody tr'],
    emit: 'shorthand',
    keyframe: 'oc-table-enter-row',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'row' },
  },
  {
    name: 'table-cell',
    scope: 'table',
    comment: 'Cell text: fade in synced with row slide',
    selectors: ['tbody td'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.5),
    delay: { stagger: 'row' },
  },
  {
    name: 'table-heatmap-cell',
    scope: 'table',
    comment: 'Heatmap/category cell backgrounds: longer fade, once the row is halfway in',
    selectors: ['td.oc-table-heatmap', 'td.oc-table-category'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.7),
    delay: { after: when('table-row', 0.5), stagger: 'row' },
  },
  {
    name: 'table-bar-fill',
    scope: 'table',
    comment:
      'Bar fill: clip-path grow only (no opacity change to preserve resting\nopacity: 0.15 from table.css), once the row is halfway in',
    selectors: ['.oc-table-bar-fill'],
    emit: 'shorthand',
    keyframe: 'oc-table-enter-bar-fill',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { after: when('table-row', 0.5), stagger: 'row' },
  },
  {
    name: 'table-sparkline',
    scope: 'table',
    comment:
      'Sparkline SVG: clip-path reveal left-to-right once the row is mostly in.\nTargets the SVG directly (not the wrapper) to avoid clipping\nabsolutely-positioned dots and labels.',
    selectors: ['.oc-table-sparkline > svg'],
    emit: 'shorthand',
    keyframe: 'oc-enter-line',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.8),
    delay: { after: when('table-row', 0.7), stagger: 'row' },
  },
  {
    name: 'table-sparkline-dot',
    scope: 'table',
    comment: 'Sparkline dots and labels: fade in as the line draws through the end',
    selectors: ['.oc-table-sparkline-dot', '.oc-table-sparkline-labels'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.3),
    delay: { after: when('table-sparkline', 0.95), stagger: 'row' },
  },
  {
    name: 'table-search-pagination',
    scope: 'table',
    comment: 'Search and pagination: quick fade on mount',
    selectors: ['.oc-table-search', '.oc-table-pagination'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.5),
    delay: { stagger: 'none' },
  },
];

/**
 * Names that would collide with a custom property the renderers already stamp
 * with a different meaning (`--oc-annotation-delay` is the gap after the marks,
 * read inside the annotation role's own fallback).
 */
const ROLE_VAR_OVERRIDES: Partial<
  Record<EntranceRole, { delay?: string; duration?: string; after?: string }>
> = {
  annotation: { delay: '--oc-annotation-enter-delay' },
};

/**
 * Role-scoped custom property names (`--oc-<role>-delay`, `-dur`, `-after`).
 * Scoped per role because custom properties inherit: a barlist bar sits inside
 * its row, a table cell inside its row, a segment inside a stack wrapper.
 */
export function roleVars(role: EntranceRole): { delay: string; duration: string; after: string } {
  const override = ROLE_VAR_OVERRIDES[role];
  return {
    delay: override?.delay ?? `--oc-${role}-delay`,
    duration: override?.duration ?? `--oc-${role}-dur`,
    after: override?.after ?? `--oc-${role}-after`,
  };
}

const NON_OPACITY: KeyframeProperty[] = ['clip-path', 'transform', 'fill', 'r', 'fill-opacity'];

/** Every entrance role, in CSS emission order (order matters for the cascade). */
export const ENTRANCE_ROLES: readonly EntranceRoleRow[] = ROLE_DEFS.map((def) => ({
  ...def,
  geometryFraction: settleOffset(def.keyframe, NON_OPACITY),
  opacityFraction: settleOffset(def.keyframe, ['opacity']),
  vars: roleVars(def.name),
}));

const ROLE_BY_NAME = new Map(ENTRANCE_ROLES.map((row) => [row.name, row]));

export function entranceRole(role: EntranceRole): EntranceRoleRow {
  const row = ROLE_BY_NAME.get(role);
  if (!row) throw new Error(`Unknown entrance role "${role}"`);
  return row;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Inputs the CSS reads from stamped custom properties. Defaults are the CSS fallbacks. */
export interface EntranceTimingContext {
  /** `--oc-animation-stagger`, already clamped (clampStaggerDelay / mapSweepTiming). Default 80. */
  staggerMs?: number;
  /** `--oc-annotation-delay`. Default 150. */
  annotationDelayMs?: number;
  /** `--oc-point-stagger` for map points (clampStaggerDelay). Default 60. */
  pointStaggerMs?: number;
  /** A per-element stamped delay (tilemap tiles: tilemapTileDelays). Default 0. */
  delayMs?: number;
  /**
   * A per-element stamped role delay (`--oc-<role>-delay`, e.g. a line point
   * keyed on its x). Replaces the whole delay rule, as the CSS does.
   */
  stampedDelayMs?: number;
  /** Root-stamped anchor offsets (`--oc-<role>-after`), per role. */
  afterMs?: Partial<Record<EntranceRole, number>>;
  /** Stagger index of the last mark, for anchors with `ofLast`. Default 0. */
  lastMarkIndex?: number;
}

export interface EntranceTiming {
  /** When the element starts, from the entrance start. */
  delayMs: number;
  /** The CSS animation-duration of the role's keyframe. */
  durationMs: number;
  /** How long non-opacity properties (clip, transform, fill) move; 0 if none. */
  geometryMs: number;
  /** How long until opacity settles; 0 if opacity doesn't animate. */
  opacityMs: number;
  /** Duration of the separate quick fade track; 0 when the role has none. */
  fadeMs: number;
}

const DEFAULT_STAGGER_MS = 80;
const DEFAULT_ANNOTATION_DELAY_MS = 150;

/** Round away float noise from inversion (1e-6 ms is far below a frame). */
function clean(ms: number): number {
  return Math.round(ms * 1e6) / 1e6;
}

/** The base duration D a role's CSS sees as `--oc-animation-duration`. */
export function roleBaseDuration(role: EntranceRole, phase: MotionPhase): number {
  return entranceRole(role).durationBasis === 'map'
    ? mapFeatureDuration(phase.duration)
    : phase.duration;
}

function roleDurationMs(role: EntranceRole, phase: MotionPhase): number {
  const row = entranceRole(role);
  return row.duration.kind === 'base'
    ? roleBaseDuration(role, phase) * row.duration.factor
    : row.duration.ms;
}

function staggerMs(rule: StaggerRule, index: number, ctx: EntranceTimingContext): number {
  switch (rule) {
    case 'none':
      return 0;
    case 'mark':
    case 'row':
      return index * (ctx.staggerMs ?? DEFAULT_STAGGER_MS);
    case 'map-point':
      return index * (ctx.pointStaggerMs ?? MAP_POINT_STAGGER_FALLBACK_MS);
    case 'map-sweep':
      // Unstamped --oc-map-delay is 0ms, so no stagger without a context value.
      return index * (ctx.staggerMs ?? 0);
    case 'tilemap-tile':
      return ctx.delayMs ?? 0;
    default:
      return rule satisfies never;
  }
}

/** The context a parent role is timed in: shared inputs only, no per-element stamps. */
function parentContext(ctx: EntranceTimingContext): EntranceTimingContext {
  return {
    staggerMs: ctx.staggerMs,
    annotationDelayMs: ctx.annotationDelayMs,
    pointStaggerMs: ctx.pointStaggerMs,
    afterMs: ctx.afterMs,
    lastMarkIndex: ctx.lastMarkIndex,
  };
}

/**
 * When the element at `index` of a role has reached `progress` of its own
 * tween, in ms from the entrance start: its delay plus the first time its
 * curve reaches that progress.
 */
export function progressTimeMs(
  role: EntranceRole,
  index: number,
  phase: MotionPhase,
  context: EntranceTimingContext,
  progress: number,
): number {
  const { delayMs, durationMs } = entranceTiming(role, index, phase, context);
  return clean(delayMs + invertRoleEase(role, phase, progress) * durationMs);
}

/**
 * The index-free part of a role's delay: where its anchor lands for this
 * phase, in ms. This is what the renderer stamps as `--oc-<role>-after`.
 */
export function anchorMs(
  role: EntranceRole,
  phase: MotionPhase,
  context: EntranceTimingContext = {},
): number {
  const anchor = entranceRole(role).delay.after;
  if (!anchor) return 0;
  const stamped = context.afterMs?.[role];
  if (stamped !== undefined) return stamped;
  if (anchor.kind === 'sweep') return clean(anchor.progress * MAP_SWEEP_BUDGET_MS);
  const index = anchor.ofLast ? (context.lastMarkIndex ?? 0) : 0;
  return progressTimeMs(anchor.of, index, phase, parentContext(context), anchor.progress);
}

/**
 * Root custom properties for every anchored role in a scope: the anchor
 * offsets the generated CSS reads (`--oc-<role>-after`), resolved through
 * this phase's curve. CSS can't invert a curve, so the renderer does it here.
 */
export function entranceAnchorVars(
  phase: MotionPhase,
  context: EntranceTimingContext = {},
  scope: 'chart' | 'table' = 'chart',
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const row of ENTRANCE_ROLES) {
    if (row.scope !== scope || !row.delay.after) continue;
    vars[row.vars.after] = `${anchorMs(row.name, phase, context)}ms`;
  }
  return vars;
}

/**
 * Timing of the element at `index` of a role, in ms, matching what the
 * generated CSS computes from the stamped custom properties.
 */
export function entranceTiming(
  role: EntranceRole,
  index: number,
  phase: MotionPhase,
  context: EntranceTimingContext = {},
): EntranceTiming {
  const row = entranceRole(role);
  const durationMs = roleDurationMs(role, phase);
  let delayMs: number;
  if (context.stampedDelayMs !== undefined) {
    delayMs = context.stampedDelayMs;
  } else {
    delayMs = staggerMs(row.delay.stagger, index, context) + anchorMs(role, phase, context);
    if (row.delay.plusAnnotationDelay) {
      delayMs += context.annotationDelayMs ?? DEFAULT_ANNOTATION_DELAY_MS;
    }
  }
  const fadeMs = row.fade?.ms ?? 0;
  return {
    delayMs: clean(delayMs),
    durationMs: clean(durationMs),
    geometryMs: clean(durationMs * row.geometryFraction),
    opacityMs: clean(row.fade ? fadeMs : durationMs * row.opacityFraction),
    fadeMs,
  };
}

/** How many elements of a role animate, and the extremes that set its end. */
export interface EntranceRoleExtent {
  count: number;
  /** Highest index (default count - 1). */
  maxIndex?: number;
  /** Highest stamped delay (tilemap-tile). */
  maxDelayMs?: number;
  /** Highest per-element stamped role delay (`--oc-<role>-delay`). */
  maxStampedDelayMs?: number;
  /** How many of `count` carry a stamped role delay (default 0). */
  stampedCount?: number;
}

export interface EntranceEndContext
  extends Omit<EntranceTimingContext, 'delayMs' | 'stampedDelayMs'> {
  phase: MotionPhase;
  /** Elements per role: a count, or an extent. Roles with no elements are skipped. */
  roles: Partial<Record<EntranceRole, number | EntranceRoleExtent>>;
}

/**
 * When the last animated element finishes, in ms from the entrance start: the
 * max of `delay + duration` (or its fade, if longer) over every role present.
 * No buffer is added.
 */
export function entranceEndMs(context: EntranceEndContext): number {
  const { phase, roles, ...timing } = context;
  let end = 0;
  for (const [role, value] of Object.entries(roles) as [
    EntranceRole,
    number | EntranceRoleExtent,
  ][]) {
    const extent = typeof value === 'number' ? { count: value } : value;
    if (!(extent.count > 0)) continue;
    const index = extent.maxIndex ?? extent.count - 1;
    const endOf = (stampedDelayMs?: number) => {
      const t = entranceTiming(role, index, phase, {
        ...timing,
        delayMs: extent.maxDelayMs,
        stampedDelayMs,
      });
      return t.delayMs + Math.max(t.durationMs, t.fadeMs);
    };
    const stamped = extent.stampedCount ?? 0;
    if (stamped > 0 && extent.maxStampedDelayMs !== undefined) {
      end = Math.max(end, endOf(extent.maxStampedDelayMs));
    }
    if (extent.count > stamped) end = Math.max(end, endOf());
  }
  return clean(end);
}

// ---------------------------------------------------------------------------
// Easing per role
// ---------------------------------------------------------------------------

/**
 * The eased progress a role's CSS timing function gives at time progress t of
 * one keyframe segment. Author-eased roles follow the phase: a spring is
 * sampled over the base duration D (as `motionCSS` stamps it), otherwise the
 * registry curve. Mirrors the CSS, so it can overshoot on a spring.
 */
export function evalRoleEase(role: EntranceRole, phase: MotionPhase, t: number): number {
  const { timing } = entranceRole(role);
  switch (timing.kind) {
    case 'author': {
      if (phase.spring) {
        const d = roleBaseDuration(role, phase);
        const x = t < 0 ? 0 : t > 1 ? 1 : t;
        return sampleMotion({ duration: d, spring: phase.spring }, x * d).position;
      }
      return evalCurve(phase.ease ?? 'smooth', t);
    }
    case 'curve':
      return evalCurve(timing.curve, t);
    case 'css':
      return evalCubicBezier(timing.bezier, t);
    default:
      return timing satisfies never;
  }
}

/** First t in [0, 1] at which f reaches p (scan, then bisect). */
function firstReach(f: (t: number) => number, p: number): number {
  if (f(0) >= p) return 0;
  const steps = 256;
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (f(t) >= p) {
      let lo = prev;
      let hi = t;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) >= p) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prev = t;
  }
  return 1;
}

/**
 * The first share of a role's tween at which its eased progress reaches p:
 * the inverse of `evalRoleEase`. Monotone registry curves invert exactly;
 * springs and CSS beziers are searched.
 */
export function invertRoleEase(role: EntranceRole, phase: MotionPhase, p: number): number {
  const { timing } = entranceRole(role);
  if (timing.kind === 'author' && !phase.spring) {
    return invertCurve(phase.ease ?? 'smooth', p);
  }
  if (timing.kind === 'curve' && isMonotoneCurve(timing.curve)) {
    return invertCurve(timing.curve as MonotoneCurveName, p);
  }
  return firstReach((t) => evalRoleEase(role, phase, t), p);
}

// ---------------------------------------------------------------------------
// Update transitions: exits, survivors, enters (D9)
// ---------------------------------------------------------------------------

/**
 * Default exit: a removed mark's ghost fades (and collapses, for rects and
 * arcs) over 120ms. `gentle` is the fast ease-out here: on a 120ms window
 * `snap`/`snappy` are ~90% done in under 25ms, which reads as a pop, not a
 * fade. Exit geometry goes through `sampleMotion`, so it stays in [from, to].
 */
export const EXIT_FADE_MS = 120;
export const EXIT_CURVE = 'gentle' as const satisfies MonotoneCurveName;

/** Marks entering during an update start once survivors reach this share of their tween's time. */
export const UPDATE_ENTER_START = 0.4;

/** When each track of an update transition runs, in ms from its start. */
export interface UpdateTimeline {
  /** Removal ghosts fade over [0, exitMs]. */
  exitMs: number;
  /** Survivors (and chrome, labels, color) start moving here. */
  updateDelayMs: number;
  /** Entering marks fade in from here... */
  enterDelayMs: number;
  /** ...over this long, ending with the survivors. */
  enterMs: number;
  /** End of the whole transition. */
  totalMs: number;
}

/**
 * Lay out an update transition. On `snap`, a survivor sliding into a removed
 * mark's slot touches the ghost within ~25ms (a bar's neighbour covers the
 * band gap at ~0.4 progress), so no fade short enough to run alongside it
 * can clear first. When the update removes marks, survivors therefore hold
 * until the exit has finished, and enters keep their place relative to the
 * survivors. Without removals there is nothing to clear and nothing waits.
 */
export function updateTimeline(
  update: MotionPhase,
  exit: MotionPhase,
  hasRemovals: boolean,
): UpdateTimeline {
  const updateDelayMs = hasRemovals ? Math.max(0, exit.duration) : 0;
  const enterLead = UPDATE_ENTER_START * update.duration;
  return {
    exitMs: exit.duration,
    updateDelayMs,
    enterDelayMs: updateDelayMs + enterLead,
    enterMs: update.duration - enterLead,
    totalMs: Math.max(updateDelayMs + update.duration, exit.duration),
  };
}
