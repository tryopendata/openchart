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
 * Delays keyed to a parent's tween are progress points on a fixed reference
 * curve (`gentle`, the pre-Decks smooth), resolved through `invertCurve`, never the author's ease.
 * Phase 0 picks each point so it resolves to today's raw fraction of the
 * duration; spring phases keep the raw fraction.
 */

import { type CurveName, evalCurve, invertCurve, type MonotoneCurveName } from './curves';
import type { MotionPhase } from './sample';
import { sampleMotion } from './sample';
import { barlistRowDelay, MAP_POINT_STAGGER_FALLBACK_MS, mapFeatureDuration } from './stagger';

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
  | { type: 'translateY'; px: number }
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
const translateY = (px: number): KeyframeValue => ({ type: 'translateY', px });
const scale = (value: number): KeyframeValue => ({ type: 'scale', value });
const css = (value: string): KeyframeValue => ({ type: 'css', css: value });

/** Every @keyframes in styles/keyframes.css, in emission order. */
export const KEYFRAMES = {
  'oc-enter-bar': {
    comment:
      'Bar entrance: clip-path reveal bottom-to-top + fade in (vertical columns).\nBars grow upward from baseline with a soft opacity fade.',
    stops: [
      { offset: 0, values: { 'clip-path': inset(100, 0, 0, 0), opacity: num(0) } },
      { offset: 0.75, values: { opacity: num(1) } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0), opacity: num(1) } },
    ],
  },
  'oc-enter-bar-h': {
    comment:
      'Bar entrance: clip-path reveal left-to-right + fade in (horizontal bars).\nBars grow rightward from axis with a soft opacity fade.',
    stops: [
      { offset: 0, values: { 'clip-path': inset(0, 100, 0, 0), opacity: num(0) } },
      { offset: 0.75, values: { opacity: num(1) } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0), opacity: num(1) } },
    ],
  },
  'oc-enter-stack': {
    comment:
      'Stack entrance: one clip over the whole stack. Grows bottom-to-top from\n--oc-stack-from, which the renderer stamps on a stack that crosses zero so\nthe clip starts collapsed on the baseline and grows both ways from it.',
    stops: [
      {
        offset: 0,
        values: { 'clip-path': css('inset(var(--oc-stack-from, 100% 0 0 0))'), opacity: num(0) },
      },
      { offset: 0.75, values: { opacity: num(1) } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0), opacity: num(1) } },
    ],
  },
  'oc-enter-stack-h': {
    comment:
      'Horizontal stack entrance: grows left-to-right, or both ways from the\nbaseline when --oc-stack-from is stamped.',
    stops: [
      {
        offset: 0,
        values: { 'clip-path': css('inset(var(--oc-stack-from, 0 100% 0 0))'), opacity: num(0) },
      },
      { offset: 0.75, values: { opacity: num(1) } },
      { offset: 1, values: { 'clip-path': inset(0, 0, 0, 0), opacity: num(1) } },
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
    comment: 'Fade + subtle slide up for text, rule, tick, annotations',
    stops: [
      { offset: 0, values: { opacity: num(0), transform: translateY(4) } },
      { offset: 1, values: { opacity: num(1), transform: translateY(0) } },
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
      return value.px === 0 ? 'translateY(0)' : `translateY(${value.px}px)`;
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
  if (a.type === 'translateY' && b.type === 'translateY') return translateY(lerp(a.px, b.px, e));
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
 * oc-enter-bar's opacity settles at 0.75; its clip-path at 1.
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
  | 'stack-segment'
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
  /** A registry curve regardless of the author's ease (labels, annotations). */
  | { kind: 'curve'; curve: CurveName }
  /** A fixed CSS timing function, with its cubic-bezier control points for JS. */
  | { kind: 'css'; css: string; bezier: readonly [number, number, number, number] };

/** Animation duration of a role, from the base duration D. */
export type DurationRule =
  | { kind: 'base'; factor: number }
  | { kind: 'fixed'; ms: number }
  /** Stacked segments: `--oc-stack-segment-duration` (150ms fallback). */
  | { kind: 'stack-segment' };

/**
 * A progress point of a parent tween of length D on a fixed reference curve.
 * Resolves to `invertCurve(reference, progress) * D`; spring phases, whose
 * curves aren't in the registry, use `springFraction * D`.
 */
export interface ProgressPoint {
  progress: number;
  reference: MonotoneCurveName;
  springFraction: number;
}

/** How entering elements of a role are spread out by index. */
export type StaggerRule =
  | 'none'
  /** `index * --oc-animation-stagger`, index from `--oc-mark-index`. */
  | 'mark'
  /** `index * --oc-animation-stagger`, index from `--oc-row-index` (tables). */
  | 'row'
  /** Mark stagger plus `--oc-stack-pos * --oc-stack-segment-duration`. */
  | 'stack-segment'
  /** `index * --oc-point-stagger` (60ms fallback); see mapPointStagger. */
  | 'map-point'
  /** Stamped `--oc-map-delay`; JS: shuffled slot index * map stagger (mapSweepTiming). */
  | 'map-sweep'
  /** Stamped `--oc-row-delay`; JS: barlistRowDelay(index). */
  | 'barlist-row'
  /** Stamped `--oc-tile-delay`; JS: the context's delayMs (tilemapTileDelays). */
  | 'tilemap-tile';

export interface DelayRule {
  /** Start at this progress point of the parent's tween (omitted = at once). */
  after?: ProgressPoint;
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
  /** Share of the duration after which opacity has settled (0 if it doesn't animate). */
  opacityFraction: number;
  /**
   * Role-scoped custom properties the generated CSS reads first. Their
   * fallback is today's calc(), so unstamped elements behave as before.
   */
  vars: { delay: string; duration: string };
}

/** The fixed curve delay progress points are measured on. */
export const DELAY_REFERENCE_CURVE: MonotoneCurveName = 'gentle';

/** A progress point that resolves to `fraction` of D on the reference curve. */
function at(fraction: number): ProgressPoint {
  return {
    progress: evalCurve(DELAY_REFERENCE_CURVE, fraction),
    reference: DELAY_REFERENCE_CURVE,
    springFraction: fraction,
  };
}

const AUTHOR: RoleTiming = { kind: 'author' };
const EASE_IN: RoleTiming = { kind: 'css', css: 'ease-in', bezier: [0.42, 0, 1, 1] };
const LINEAR: RoleTiming = { kind: 'css', css: 'linear', bezier: [0, 0, 1, 1] };
const base = (factor: number): DurationRule => ({ kind: 'base', factor });

const ROLE_DEFS: readonly EntranceRoleDef[] = [
  {
    name: 'bar',
    scope: 'chart',
    comment:
      'Vertical bars (default): smooth ease-out, no overshoot.\noc-mark-bar is reserved for future mark type aliases.\nA bar with a value-end radius draws as <path> rather than <rect>\n(SVG rx rounds all four corners or none), so both shapes match.',
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
    name: 'stack-segment',
    scope: 'chart',
    comment:
      'Stacked bar/column segments: chain sequentially so each segment starts\nright when the previous one finishes, creating one fluid reveal.\nUses linear easing so handoffs between segments are seamless (no\ndeceleration/acceleration stutter at segment boundaries).',
    selectors: ['.oc-mark-rect[data-stack-pos] :is(rect, path)'],
    emit: ['duration', 'timing', 'delay'],
    keyframe: 'oc-enter-bar',
    horizontalKeyframe: 'oc-enter-bar-h',
    timing: LINEAR,
    durationBasis: 'phase',
    duration: { kind: 'stack-segment' },
    delay: { stagger: 'stack-segment' },
  },
  {
    name: 'stack-reveal',
    scope: 'chart',
    comment:
      'Spring stacks reveal as one group per stack, each on its own stagger slot;\ntheir segments do not animate. A stack that crosses zero grows both ways\nfrom the baseline (--oc-stack-from).',
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
      'Arc marks (pie/donut slices): simple fade in.\nScale transforms break arc positioning because arcs use translate()\non parent groups. A clean fade is more elegant for pie/donut anyway.',
    selectors: ['.oc-mark-arc'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { stagger: 'mark' },
  },
  {
    name: 'point',
    scope: 'chart',
    comment:
      'Point marks (scatter, dot).\nPoints render as bare <circle> elements with class oc-mark-point directly,\nnot wrapped in a group, so we target circle.oc-mark-point (not descendant).\nDuration is 40% of the configured duration (quick pop-in relative to other marks).',
    selectors: ['circle.oc-mark-point', 'circle.oc-mark-circle'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.4),
    delay: { stagger: 'mark' },
  },
  {
    name: 'line-point',
    scope: 'chart',
    comment: 'Points on line/area charts: delay so they pop in as the line draws through.',
    selectors: ['.oc-mark-line ~ circle.oc-mark-point', '.oc-mark-area ~ circle.oc-mark-point'],
    emit: ['duration', 'delay'],
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.4),
    delay: { after: at(0.35), stagger: 'mark' },
  },
  {
    name: 'text',
    scope: 'chart',
    comment: 'Text marks: fade + slight slide up',
    selectors: ['.oc-mark-text text'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.6),
    delay: { stagger: 'mark' },
  },
  {
    name: 'rule',
    scope: 'chart',
    comment: 'Rule marks: fade in',
    selectors: ['.oc-mark-rule line'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.5),
    delay: { stagger: 'mark' },
  },
  {
    name: 'tick',
    scope: 'chart',
    comment: 'Tick marks: fade in',
    selectors: ['.oc-mark-tick line'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.5),
    delay: { stagger: 'mark' },
  },
  {
    name: 'label',
    scope: 'chart',
    comment: 'Data labels: fade after their parent mark',
    selectors: ['.oc-mark-label'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: { kind: 'curve', curve: 'smooth' },
    durationBasis: 'phase',
    duration: { kind: 'fixed', ms: 250 },
    delay: { after: at(0.7), stagger: 'mark' },
  },
  {
    name: 'annotation',
    scope: 'chart',
    comment: 'Annotations: fade in after marks finish',
    selectors: ['.oc-annotation'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: { kind: 'curve', curve: 'smooth' },
    durationBasis: 'phase',
    duration: { kind: 'fixed', ms: 300 },
    delay: { after: at(1), plusAnnotationDelay: true, stagger: 'none' },
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
    comment: 'Map borders: fade in near the end of the feature sweep',
    selectors: ['.oc-map-borders path'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: EASE_IN,
    durationBasis: 'map',
    duration: base(0.4),
    delay: { after: at(0.7), stagger: 'none' },
  },
  {
    name: 'map-point',
    scope: 'chart',
    comment:
      "Map points: gentle scale (0.75->1) + fade pop-in after borders.\ntransform-origin set per-circle in the renderer so scale happens\naround each circle's own center, not the SVG origin.",
    selectors: ['.oc-map-point'],
    emit: 'shorthand',
    keyframe: 'oc-enter-map-point',
    timing: AUTHOR,
    durationBasis: 'map',
    duration: base(0.4),
    delay: { after: at(0.8), stagger: 'map-point' },
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
      'Sankey links: fade in after nodes, with stagger.\nLinks delay by 30% of duration so nodes appear first, then links flow in.',
    selectors: ['.oc-sankey-link path'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(1),
    delay: { after: at(0.3), stagger: 'mark' },
  },
  {
    name: 'barlist-row',
    scope: 'chart',
    comment: 'Barlist rows: fade + slide up per row, bars grow left-to-right',
    selectors: ['.oc-barlist-row'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.6),
    delay: { stagger: 'barlist-row' },
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
    delay: { stagger: 'barlist-row' },
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
    comment: 'Heatmap/category cell backgrounds: longer fade, delayed after row appears',
    selectors: ['td.oc-table-heatmap', 'td.oc-table-category'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.7),
    delay: { after: at(0.3), stagger: 'row' },
  },
  {
    name: 'table-bar-fill',
    scope: 'table',
    comment:
      'Bar fill: clip-path grow only (no opacity change to preserve resting\nopacity: 0.15 from table.css)',
    selectors: ['.oc-table-bar-fill'],
    emit: 'shorthand',
    keyframe: 'oc-table-enter-bar-fill',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.8),
    delay: { after: at(0.3), stagger: 'row' },
  },
  {
    name: 'table-sparkline',
    scope: 'table',
    comment:
      'Sparkline SVG: clip-path reveal left-to-right. Targets the SVG directly\n(not the wrapper) to avoid clipping absolutely-positioned dots and labels.',
    selectors: ['.oc-table-sparkline > svg'],
    emit: 'shorthand',
    keyframe: 'oc-enter-line',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.8),
    delay: { after: at(0.4), stagger: 'row' },
  },
  {
    name: 'table-sparkline-dot',
    scope: 'table',
    comment: 'Sparkline dots and labels: fade in after the line draws through',
    selectors: ['.oc-table-sparkline-dot', '.oc-table-sparkline-labels'],
    emit: 'shorthand',
    keyframe: 'oc-enter-fade-only',
    timing: AUTHOR,
    durationBasis: 'phase',
    duration: base(0.3),
    delay: { after: at(0.8), stagger: 'row' },
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
const ROLE_VAR_OVERRIDES: Partial<Record<EntranceRole, { delay?: string; duration?: string }>> = {
  annotation: { delay: '--oc-annotation-enter-delay' },
};

/**
 * Role-scoped custom property names (`--oc-<role>-delay`, `--oc-<role>-dur`).
 * Scoped per role because custom properties inherit: a barlist bar sits inside
 * its row, a table cell inside its row, a segment inside a stack wrapper.
 */
export function roleVars(role: EntranceRole): { delay: string; duration: string } {
  const override = ROLE_VAR_OVERRIDES[role];
  return {
    delay: override?.delay ?? `--oc-${role}-delay`,
    duration: override?.duration ?? `--oc-${role}-dur`,
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
  /** `--oc-animation-stagger`, already clamped (clampStaggerDelay / mapSweepTiming). Default 30. */
  staggerMs?: number;
  /** `--oc-annotation-delay`. Default 150. */
  annotationDelayMs?: number;
  /** `--oc-stack-pos` of a stacked segment. Default 0. */
  stackPos?: number;
  /** `--oc-stack-segment-duration`. Default 150. */
  stackSegmentMs?: number;
  /** `--oc-point-stagger` for map points (mapPointStagger). Default 60. */
  pointStaggerMs?: number;
  /** A per-element stamped delay (tilemap tiles: tilemapTileDelays). Default 0. */
  delayMs?: number;
}

export interface EntranceTiming {
  /** When the element starts, from the entrance start. */
  delayMs: number;
  /** The CSS animation-duration. */
  durationMs: number;
  /** How long non-opacity properties (clip, transform, fill) move; 0 if none. */
  geometryMs: number;
  /** How long until opacity settles; 0 if opacity doesn't animate. */
  opacityMs: number;
}

const DEFAULT_STAGGER_MS = 30;
const DEFAULT_ANNOTATION_DELAY_MS = 150;
const DEFAULT_STACK_SEGMENT_MS = 150;

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

/** Resolve a progress point to a fraction of D for this phase. */
export function resolveProgressPoint(point: ProgressPoint, phase: MotionPhase): number {
  return phase.spring ? point.springFraction : invertCurve(point.reference, point.progress);
}

function staggerMs(rule: StaggerRule, index: number, ctx: EntranceTimingContext): number {
  switch (rule) {
    case 'none':
      return 0;
    case 'mark':
    case 'row':
      return index * (ctx.staggerMs ?? DEFAULT_STAGGER_MS);
    case 'stack-segment':
      return (
        index * (ctx.staggerMs ?? DEFAULT_STAGGER_MS) +
        (ctx.stackPos ?? 0) * (ctx.stackSegmentMs ?? DEFAULT_STACK_SEGMENT_MS)
      );
    case 'map-point':
      return index * (ctx.pointStaggerMs ?? MAP_POINT_STAGGER_FALLBACK_MS);
    case 'map-sweep':
      // Unstamped --oc-map-delay is 0ms, so no stagger without a context value.
      return index * (ctx.staggerMs ?? 0);
    case 'barlist-row':
      return barlistRowDelay(index);
    case 'tilemap-tile':
      return ctx.delayMs ?? 0;
    default:
      return rule satisfies never;
  }
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
  const d = roleBaseDuration(role, phase);
  const durationMs =
    row.duration.kind === 'base'
      ? d * row.duration.factor
      : row.duration.kind === 'fixed'
        ? row.duration.ms
        : (context.stackSegmentMs ?? DEFAULT_STACK_SEGMENT_MS);
  let delayMs = staggerMs(row.delay.stagger, index, context);
  if (row.delay.after) delayMs += d * resolveProgressPoint(row.delay.after, phase);
  if (row.delay.plusAnnotationDelay) {
    delayMs += context.annotationDelayMs ?? DEFAULT_ANNOTATION_DELAY_MS;
  }
  return {
    delayMs: clean(delayMs),
    durationMs: clean(durationMs),
    geometryMs: clean(durationMs * row.geometryFraction),
    opacityMs: clean(durationMs * row.opacityFraction),
  };
}

/** How many elements of a role animate, and the extremes that set its end. */
export interface EntranceRoleExtent {
  count: number;
  /** Highest index (default count - 1). */
  maxIndex?: number;
  /** Highest `--oc-stack-pos` (stack-segment). */
  maxStackPos?: number;
  /** Highest stamped delay (tilemap-tile). */
  maxDelayMs?: number;
}

export interface EntranceEndContext extends Omit<EntranceTimingContext, 'stackPos' | 'delayMs'> {
  phase: MotionPhase;
  /** Elements per role: a count, or an extent. Roles with no elements are skipped. */
  roles: Partial<Record<EntranceRole, number | EntranceRoleExtent>>;
}

/**
 * When the last animated element finishes, in ms from the entrance start: the
 * max of `delay + duration` over every role present. No buffer is added.
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
    const t = entranceTiming(role, extent.maxIndex ?? extent.count - 1, phase, {
      ...timing,
      stackPos: extent.maxStackPos,
      delayMs: extent.maxDelayMs,
    });
    end = Math.max(end, t.delayMs + t.durationMs);
  }
  return clean(end);
}

// ---------------------------------------------------------------------------
// Easing per role
// ---------------------------------------------------------------------------

/** Evaluate a CSS cubic-bezier(x1, y1, x2, y2) at time progress t. */
export function evalCubicBezier(
  bezier: readonly [number, number, number, number],
  t: number,
): number {
  const [x1, y1, x2, y2] = bezier;
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  if (x1 === y1 && x2 === y2) return x;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  // Newton first, bisection as the fallback (x(s) is monotone for x1, x2 in [0, 1]).
  let s = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(s) - x;
    if (Math.abs(err) < 1e-7) return ((ay * s + by) * s + cy) * s;
    const d = slopeX(s);
    if (Math.abs(d) < 1e-6) break;
    s -= err / d;
  }
  let lo = 0;
  let hi = 1;
  s = x;
  for (let i = 0; i < 40; i++) {
    const v = sampleX(s);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return ((ay * s + by) * s + cy) * s;
}

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
