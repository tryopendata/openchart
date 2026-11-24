/**
 * Animated GIF export.
 *
 * Unlike PNG/JPG (single static frame), GIF export must reproduce the chart's
 * entrance animation across many frames. OpenChart entrance animations are pure
 * CSS keyframes that mutate `clip-path`/`opacity`/`transform` in *computed*
 * style, which `XMLSerializer` does not capture — so serializing the live,
 * mid-animation SVG yields the base markup on every frame (a static GIF).
 *
 * This module sidesteps that by *synthesizing* frames deterministically: it
 * takes the settled, final-state SVG plus the resolved animation config,
 * computes each animated element's value at time `t` in JS, stamps
 * `clip-path`/`opacity` as INLINE attributes on a clone (inline values DO
 * serialize), rasterizes that clone, and encodes each frame with gifenc.
 *
 * Which elements animate, their keyframes, curves and delays all come from the
 * choreography table in core (`ENTRANCE_ROLES`, `KEYFRAMES`), the same source
 * the entrance CSS is generated from, so a GIF frame matches the live CSS at
 * the same time. Only the entrance is reproduced; the on-screen CSS animation
 * is untouched. `gifenc` is an optional peer dependency, loaded dynamically.
 */

import {
  type AnimationEase,
  cssTokenDefault,
  type EntranceRole,
  entranceRole,
  entranceTiming,
  evalCurve,
  evalKeyframes,
  evalRoleEase,
  FADE_CURVE,
  KEYFRAMES,
  type KeyframeName,
  type KeyframeProperty,
  type KeyframeStop,
  type KeyframeValue,
  type MotionPhase,
  type ResolvedAnimation,
  type ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
import { type EntranceScan, entranceRoleOf, scanEntrance, scanEntranceEndMs } from './animation';
import { embedFonts } from './export';
import { encodeSVGFrames } from './gif-frame-encoder';
import { injectThemeStyleBlock } from './theme-style-block';

export { isModuleNotFound, resolveRepeat } from './gif-frame-encoder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GIFExportOptions {
  /** Frames per second to capture. Defaults to 25. */
  fps?: number;
  /** DPI scaling factor, matching PNG export. Defaults to 2. */
  dpi?: number;
  /**
   * Loop behavior. Defaults to play-once (hold the final frame):
   * - `false` / omitted: play once, then hold the final frame
   * - `true`: loop forever
   * - a number: loop that many times, then hold
   */
  loop?: boolean | number;
  /**
   * Explicit capture duration in ms. Defaults to the choreography table's end
   * for the elements present (`entranceEndMs`) plus a 300ms tail.
   */
  durationMs?: number;
  /** Embed fonts as base64 data URIs so text matches on-screen. Defaults to true. */
  embedFonts?: boolean;
  /**
   * Opaque background fill. GIF can't carry partial alpha, so a transparent
   * chart would composite onto black. Defaults to the chart's own background
   * color (or white if the chart is transparent).
   */
  backgroundColor?: string;
  /**
   * Resolved theme to inline as a `<style>` block so class-based fills (metric
   * cells, eyebrow dot, legend text) survive serialization. Omit to skip.
   */
  theme?: ResolvedTheme;
}

/** The keyframe family an element's entrance plays (coarse; `role` is exact). */
export type AnimationKind =
  | 'bar-vertical'
  | 'bar-horizontal'
  | 'line-area'
  | 'map-fill'
  | 'map-point'
  | 'slide'
  | 'fade';

export interface AnimatedTarget {
  /** The element in the CLONE that receives per-frame inline styles. */
  el: SVGElement;
  kind: AnimationKind;
  /** Choreography role. Defaults by `kind` (bar, bar-h, line-area, arc). */
  role?: EntranceRole;
  /** Keyframe to evaluate. Defaults to the role's. */
  keyframe?: KeyframeName;
  /** Start offset in ms (the role's delay rule). */
  startMs: number;
  /** Duration of this element's own animation in ms. */
  durationMs: number;
  /** Duration of the role's separate quick fade track, when it has one (opacity follows it). */
  fadeMs?: number;
  /**
   * The element's own inline values for the properties frames overwrite,
   * captured before the first frame so the settled frame restores them (a
   * focus-dimmed map feature rests at its inline dim opacity, not 1).
   */
  rest?: Partial<Record<FrameProperty, string>>;
}

/** Inline properties a frame writes. */
type FrameProperty = 'opacity' | 'transform' | 'clip-path' | 'fill';
const FRAME_PROPERTIES: readonly FrameProperty[] = ['opacity', 'transform', 'clip-path', 'fill'];

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

function kindOf(keyframe: KeyframeName): AnimationKind {
  if (keyframe === 'oc-enter-bar' || keyframe === 'oc-enter-stack') return 'bar-vertical';
  if (keyframe === 'oc-enter-bar-h' || keyframe === 'oc-enter-stack-h') return 'bar-horizontal';
  if (keyframe === 'oc-enter-line') return 'line-area';
  if (keyframe === 'oc-enter-map-fill') return 'map-fill';
  if (keyframe === 'oc-enter-map-point') return 'map-point';
  if (keyframe === 'oc-enter-slide') return 'slide';
  return 'fade';
}

/**
 * Classify an animated element (or the mark group holding it) into the
 * choreography role whose CSS rule animates it, and return the element that
 * receives inline styles. Roles come from the same selectors the generated
 * CSS uses. Returns null when a bar group has no shape child to clip.
 * Unrecognized elements fall back to a plain opacity fade rather than a hard
 * pop-in.
 */
export function classifyTarget(
  groupOrEl: SVGElement,
): { el: SVGElement; kind: AnimationKind; role?: EntranceRole } | null {
  const candidates = [groupOrEl, ...Array.from(groupOrEl.querySelectorAll<SVGElement>('*'))];
  for (const el of candidates) {
    const match = entranceRoleOf(el);
    if (match) return { el, kind: kindOf(match.keyframe), role: match.role };
  }
  const cls = groupOrEl.getAttribute('class') ?? '';
  if (cls.includes('oc-mark-rect') || cls.includes('oc-mark-bar')) return null;
  return { el: groupOrEl, kind: 'fade' };
}

/**
 * Build the list of animated targets from a cloned SVG: every element the
 * generated entrance CSS animates, timed by the choreography table exactly as
 * the CSS times it (same stamped custom properties, same delay rules).
 */
function collectTargets(scan: EntranceScan, phase: MotionPhase): AnimatedTarget[] {
  return scan.elements.map((e) => {
    const timing = entranceTiming(e.role, e.index, phase, { ...scan.context, ...e.context });
    const el = e.el as SVGElement;
    const rest: Partial<Record<FrameProperty, string>> = {};
    for (const prop of FRAME_PROPERTIES) {
      const value = el.style.getPropertyValue(prop);
      if (value) rest[prop] = value;
    }
    return {
      el,
      rest,
      kind: kindOf(e.keyframe),
      role: e.role,
      keyframe: e.keyframe,
      startMs: timing.delayMs,
      durationMs: timing.durationMs,
      ...(timing.fadeMs > 0 ? { fadeMs: timing.fadeMs } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Per-frame interpolation
// ---------------------------------------------------------------------------

/** Fallback enter duration when neither the SVG nor the config carries one. */
const DEFAULT_ENTER_MS = 800;
/** Frames held after the last element settles. */
const CAPTURE_TAIL_MS = 300;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function formatInset(v: { top: number; right: number; bottom: number; left: number }): string {
  const side = (n: number) => (n === 0 ? '0' : `${n}%`);
  return `inset(${side(v.top)} ${side(v.right)} ${side(v.bottom)} ${side(v.left)})`;
}

/**
 * A custom property as the cascade hands it to `el`: its own inline value, or
 * the nearest ancestor's (theme tokens such as `--oc-secondary` sit on the
 * root). The export clone is detached, so computed style can't answer.
 */
function readVar(el: Element, name: string): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const value = (node as Element & Partial<ElementCSSInlineStyle>).style
      ?.getPropertyValue(name)
      .trim();
    if (value) return value;
  }
  return '';
}

/**
 * A `fill` stop resolved against the element (`var(--oc-feature-fill)`), or
 * undefined when the custom property isn't set anywhere up the tree.
 */
function resolveFill(el: SVGElement, value: KeyframeValue): string | undefined {
  if (value.type !== 'css') return undefined;
  return substituteVars(el, value.css).trim() || undefined;
}

/** Replace every `var(--x, fallback)` in `css` with its value as `el` sees it. */
function substituteVars(el: Element, css: string): string {
  return css.replace(
    /var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,
    (_, name: string, fallback?: string) => readVar(el, name) || fallback || '',
  );
}

/** A paint the browser interpolates as a color: not a pattern, gradient or `none`. */
const isColorPaint = (paint: string): boolean =>
  !/^(url\(|none$|inherit$|currentcolor$)/i.test(paint);

/**
 * Evaluate a two-stop `fill` keyframe on the eased progress `e`. Colors mix in
 * sRGB, as CSS animates legacy colors; a paint that isn't a color (the
 * `url(#hatch)` on no-data map features) switches at the eased midpoint, as
 * the browser flips a non-interpolable value.
 */
function evalFill(el: SVGElement, keyframe: KeyframeName, e: number): string | undefined {
  const stops = (KEYFRAMES[keyframe].stops as readonly KeyframeStop[]).filter(
    (s) => s.values.fill !== undefined,
  );
  if (stops.length !== 2) return undefined;
  const from = resolveFill(el, stops[0].values.fill!);
  const to = resolveFill(el, stops[1].values.fill!);
  if (!from || !to) return undefined;
  if (!isColorPaint(from) || !isColorPaint(to)) return e < 0.5 ? from : to;
  return interpolateRgb(from, to)(e);
}

/**
 * Resolve a keyframe value JS can't interpolate as written (`var(--x, 1)`,
 * `inset(var(--oc-stack-from, 100% 0 0 0))`) against the element's stamped
 * custom properties, as the browser does. Undefined when the result is not a
 * number or a percentage inset (a fill color); the attribute already holds
 * the settled value then.
 */
function resolveCSSValue(el: SVGElement, css: string): KeyframeValue | undefined {
  const substituted = substituteVars(el, css);
  const translateMatch = /^translate\(\s*([-\d.e]+)px\s*,\s*([-\d.e]+)px\s*\)$/.exec(
    substituted.trim(),
  );
  if (translateMatch) {
    const x = Number.parseFloat(translateMatch[1]);
    const y = Number.parseFloat(translateMatch[2]);
    return Number.isFinite(x) && Number.isFinite(y) ? { type: 'translate', x, y } : undefined;
  }
  const insetMatch = /^inset\(([^)]*)\)$/.exec(substituted.trim());
  if (insetMatch) {
    const sides = insetMatch[1]
      .trim()
      .split(/\s+/)
      .map((v) => Number.parseFloat(v));
    if (sides.length < 1 || sides.length > 4 || sides.some((v) => !Number.isFinite(v))) {
      return undefined;
    }
    // CSS shorthand expansion: top, right = top, bottom = top, left = right.
    const [top, right = top, bottom = top, left = right] = sides;
    return { type: 'inset', top, right, bottom, left };
  }
  const v = Number(substituted.trim());
  return Number.isFinite(v) ? { type: 'number', value: v } : undefined;
}

/**
 * Evaluate one property of a two-stop keyframe whose values hold custom
 * properties: resolve both ends, then interpolate on the eased progress.
 */
function evalResolved(
  el: SVGElement,
  keyframe: KeyframeName,
  prop: KeyframeProperty,
  p: number,
  ease: (t: number) => number,
): KeyframeValue | undefined {
  const stops = (KEYFRAMES[keyframe].stops as readonly KeyframeStop[]).filter(
    (s) => s.values[prop] !== undefined,
  );
  if (stops.length !== 2 || stops[0].offset !== 0 || stops[1].offset !== 1) return undefined;
  const resolve = (v: KeyframeValue) => (v.type === 'css' ? resolveCSSValue(el, v.css) : v);
  const a = resolve(stops[0].values[prop]!);
  const b = resolve(stops[1].values[prop]!);
  const e = ease(p);
  const lerp = (x: number, y: number) => x + (y - x) * e;
  if (a?.type === 'number' && b?.type === 'number') {
    return { type: 'number', value: lerp(a.value, b.value) };
  }
  if (a?.type === 'translate' && b?.type === 'translate') {
    return { type: 'translate', x: lerp(a.x, b.x), y: lerp(a.y, b.y) };
  }
  if (a?.type === 'inset' && b?.type === 'inset') {
    return {
      type: 'inset',
      top: lerp(a.top, b.top),
      right: lerp(a.right, b.right),
      bottom: lerp(a.bottom, b.bottom),
      left: lerp(a.left, b.left),
    };
  }
  return undefined;
}

function hasCssStop(keyframe: KeyframeName, prop: KeyframeProperty): boolean {
  return (KEYFRAMES[keyframe].stops as readonly KeyframeStop[]).some(
    (s) => s.values[prop]?.type === 'css',
  );
}

/** The role a hand-built target without one plays, by keyframe family. */
const DEFAULT_ROLE: Record<AnimationKind, EntranceRole> = {
  'bar-vertical': 'bar',
  'bar-horizontal': 'bar-h',
  'line-area': 'line-area',
  'map-fill': 'map-feature',
  'map-point': 'map-point',
  slide: 'barlist-row',
  fade: 'arc',
};

/**
 * Apply the interpolated entrance state for a target at absolute time `nowMs`,
 * writing inline `clip-path`/`opacity`/`transform` so it survives
 * serialization. The keyframe and its easing come from the choreography
 * table: each keyframe segment is eased by the role's curve (`evalRoleEase`,
 * which honours `snappy` and springs), as CSS applies the timing function per
 * keyframe segment.
 */
export function applyFrameState(
  target: AnimatedTarget,
  nowMs: number,
  easeKind: AnimationEase,
  phase?: MotionPhase,
): void {
  const role = target.role ?? DEFAULT_ROLE[target.kind];
  const keyframe = target.keyframe ?? entranceRole(role).keyframe;
  const motion: MotionPhase = {
    ...phase,
    duration: phase?.duration ?? target.durationMs,
    ease: phase?.ease ?? easeKind,
  };
  const p = clamp01((nowMs - target.startMs) / target.durationMs);
  const ease = (t: number) => evalRoleEase(role, motion, t);
  const values = evalKeyframes(keyframe, p, ease);
  const style = target.el.style;

  for (const [prop, raw] of Object.entries(values) as [KeyframeProperty, KeyframeValue][]) {
    if (prop === 'fill') {
      const fill = evalFill(target.el, keyframe, ease(p));
      if (fill) style.setProperty('fill', fill);
      continue;
    }
    // A stop holding a custom property (`--oc-bar-from`, `--oc-stack-from`) is
    // resolved against the element, even past the midpoint where evalKeyframes
    // would hand back the literal end stop.
    const value = hasCssStop(keyframe, prop)
      ? evalResolved(target.el, keyframe, prop, p, ease)
      : raw;
    if (!value) continue;
    switch (value.type) {
      case 'number':
        if (prop === 'opacity') style.opacity = String(clamp01(value.value));
        break;
      case 'inset':
        if (prop === 'clip-path') style.clipPath = formatInset(value);
        break;
      case 'translateY':
        style.transform = `translateY(${value.value}${value.unit})`;
        break;
      case 'translate':
        style.transform = `translate(${value.x}px, ${value.y}px)`;
        break;
      case 'scale':
        style.transform = `scale(${value.value})`;
        break;
      case 'css':
        break;
      default:
        value satisfies never;
    }
  }
  // The quick fade track runs alongside the keyframe on its own clock.
  if (target.fadeMs) {
    const f = clamp01((nowMs - target.startMs) / target.fadeMs);
    style.opacity = String(clamp01(evalCurve(FADE_CURVE, f)));
  }
}

/** Put back the element's own inline values so the settled frame renders at rest. */
function clearFrameState(target: AnimatedTarget): void {
  const style = target.el.style;
  for (const prop of FRAME_PROPERTIES) {
    const rest = target.rest?.[prop];
    if (rest) style.setProperty(prop, rest);
    else style.removeProperty(prop);
  }
}

// ---------------------------------------------------------------------------
// Frame sampler
// ---------------------------------------------------------------------------

/** Writes the entrance state at a given time onto one SVG, in place. */
export interface FrameSampler {
  /** When the last element settles, by the choreography table (ms). */
  readonly endMs: number;
  /** Write every target's state at `nowMs`, or restore the settled scene (`null`). */
  apply(nowMs: number | null): void;
}

/**
 * Prepare `svg` (a settled scene carrying its entrance stamps) for frame
 * sampling: find every element the entrance animates and time it exactly as
 * the CSS does. Frames then mutate `svg` in place.
 */
export function createFrameSampler(
  svg: SVGElement,
  animation: ResolvedAnimation | undefined,
  theme?: ResolvedTheme,
): FrameSampler {
  // Resolve timing from the config with defaults as a fallback. The stamped
  // custom properties on the SVG (read by scanEntrance) take precedence,
  // since they are exactly what the live CSS used.
  const enter = animation?.enter || undefined;
  const easeKind: AnimationEase = enter?.ease ?? 'smooth';
  // The map fill reveal starts from the theme's neutral `--oc-secondary`. A
  // live export carries it over from the page cascade; an export with an
  // explicit theme doesn't, so fall back to the token's default for its mode.
  if (!readVar(svg, '--oc-secondary')) {
    svg.style.setProperty(
      '--oc-secondary',
      cssTokenDefault('--oc-secondary', theme?.isDark ? 'dark' : 'light'),
    );
  }
  const scan = scanEntrance(svg);
  const phase: MotionPhase = {
    ...enter,
    duration: scan.durationMs ?? enter?.duration ?? DEFAULT_ENTER_MS,
    ease: easeKind,
  };
  if (scan.context.annotationDelayMs === undefined && animation?.annotationDelay !== undefined) {
    scan.context.annotationDelayMs = animation.annotationDelay;
  }
  if (scan.context.staggerMs === undefined && enter) {
    scan.context.staggerMs = enter.staggerDelay;
  }
  const targets = collectTargets(scan, phase);
  return {
    endMs: scanEntranceEndMs(scan, phase),
    apply(nowMs) {
      for (const t of targets) {
        if (nowMs === null) clearFrameState(t);
        else applyFrameState(t, nowMs, easeKind, phase);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Render a chart's entrance animation to an animated GIF Blob.
 *
 * @param svgElement - The settled, fully-rendered chart SVG (animation complete).
 * @param animation - The chart's resolved animation config (for exact timing).
 *   When undefined, timing falls back to sensible defaults.
 * @param options - fps, dpi, loop, duration, font-embedding overrides.
 * @returns A Promise resolving to the GIF Blob.
 */
export async function exportGIF(
  svgElement: SVGElement,
  animation: ResolvedAnimation | undefined,
  options?: GIFExportOptions,
): Promise<Blob> {
  return encodeSVGFrames(svgElement, options, async () => {
    const fps = options?.fps ?? 25;
    const clone = svgElement.cloneNode(true) as SVGElement;
    injectThemeStyleBlock(clone, options?.theme);
    if (options?.embedFonts ?? true) await embedFonts(clone);
    const sampler = createFrameSampler(clone, animation, options?.theme);

    // Capture the choreography plus a short tail unless the caller sets a duration.
    const totalMs = options?.durationMs ?? sampler.endMs + CAPTURE_TAIL_MS;
    const frameDelay = Math.round(1000 / fps);
    return {
      svg: clone,
      count: Math.max(1, Math.round((totalMs / 1000) * fps)),
      draw(index) {
        sampler.apply(index === null ? null : (index / fps) * 1000);
        return frameDelay;
      },
    };
  });
}
