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
  type EntranceRole,
  entranceRole,
  entranceTiming,
  evalKeyframes,
  evalRoleEase,
  KEYFRAMES,
  type KeyframeName,
  type KeyframeProperty,
  type KeyframeStop,
  type KeyframeValue,
  type MotionPhase,
  type ResolvedAnimation,
  type ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { type EntranceScan, entranceRoleOf, scanEntrance, scanEntranceEndMs } from './animation';
import {
  embedFonts,
  ensureSVGDimensions,
  exportSVG,
  getSVGBackgroundColor,
  getSVGDimensions,
  rasterizeSVGToCanvas,
} from './export';
import { readCanvasSRGB } from './gif-encode';
import { injectThemeStyleBlock } from './theme-style-block';

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
export type AnimationKind = 'bar-vertical' | 'bar-horizontal' | 'line-area' | 'fade';

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
}

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

function kindOf(keyframe: KeyframeName): AnimationKind {
  if (keyframe === 'oc-enter-bar' || keyframe === 'oc-enter-stack') return 'bar-vertical';
  if (keyframe === 'oc-enter-bar-h' || keyframe === 'oc-enter-stack-h') return 'bar-horizontal';
  if (keyframe === 'oc-enter-line') return 'line-area';
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
    return {
      el: e.el as SVGElement,
      kind: kindOf(e.keyframe),
      role: e.role,
      keyframe: e.keyframe,
      startMs: timing.delayMs,
      durationMs: timing.durationMs,
    };
  });
}

// ---------------------------------------------------------------------------
// Per-frame interpolation
// ---------------------------------------------------------------------------

/** Fallback enter duration when neither the SVG nor the config carries one. */
const DEFAULT_ENTER_MS = 600;
/** Frames held after the last element settles. */
const CAPTURE_TAIL_MS = 300;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Distinguish "the optional gifenc peer isn't installed" from a real error
 * thrown while loading it. Node/bundlers use ERR_MODULE_NOT_FOUND /
 * MODULE_NOT_FOUND / "Cannot find module" for the former.
 */
export function isModuleNotFound(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return true;
  const message = (err as { message?: string })?.message ?? '';
  return /cannot find (module|package)|failed to (resolve|fetch)/i.test(message);
}

/**
 * Map the `loop` option to gifenc's `repeat` value:
 * `true` → 0 (loop forever), a number → that count, otherwise → -1 (play once,
 * hold the final frame — the default and the common editorial case).
 */
export function resolveRepeat(loop: boolean | number | undefined): number {
  if (loop === true) return 0;
  if (typeof loop === 'number') return loop;
  return -1;
}

function formatInset(v: { top: number; right: number; bottom: number; left: number }): string {
  const side = (n: number) => (n === 0 ? '0' : `${n}%`);
  return `inset(${side(v.top)} ${side(v.right)} ${side(v.bottom)} ${side(v.left)})`;
}

/**
 * Resolve a keyframe value JS can't interpolate as written (`var(--x, 1)`,
 * `inset(var(--oc-stack-from, 100% 0 0 0))`) against the element's stamped
 * custom properties, as the browser does. Undefined when the result is not a
 * number or a percentage inset (a fill color); the attribute already holds
 * the settled value then.
 */
function resolveCSSValue(el: SVGElement, css: string): KeyframeValue | undefined {
  const substituted = css.replace(
    /var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,
    (_, name: string, fallback?: string) => el.style.getPropertyValue(name) || fallback || '',
  );
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

/** The role a hand-built target without one plays, by keyframe family. */
const DEFAULT_ROLE: Record<AnimationKind, EntranceRole> = {
  'bar-vertical': 'bar',
  'bar-horizontal': 'bar-h',
  'line-area': 'line-area',
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
    const value = raw.type === 'css' ? evalResolved(target.el, keyframe, prop, p, ease) : raw;
    if (!value) continue;
    switch (value.type) {
      case 'number':
        if (prop === 'opacity') style.opacity = String(clamp01(value.value));
        break;
      case 'inset':
        if (prop === 'clip-path') style.clipPath = formatInset(value);
        break;
      case 'translateY':
        style.transform = `translateY(${value.px}px)`;
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
}

/** Clear any inline entrance styles so the settled frame renders at rest. */
function clearFrameState(target: AnimatedTarget): void {
  const style = target.el.style;
  style.clipPath = '';
  style.opacity = '';
  style.transform = '';
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
  let gifenc: typeof import('gifenc');
  try {
    gifenc = await import('gifenc');
  } catch (err) {
    // Only a genuine "module not found" means the optional peer is absent. Any
    // other failure (a real bug in gifenc's module eval, a corrupt install) must
    // surface with its context, not the misleading install hint.
    if (isModuleNotFound(err)) {
      throw new Error(
        "GIF export requires the optional 'gifenc' peer dependency. Install it: npm install gifenc",
      );
    }
    throw new Error('GIF export failed to load the gifenc encoder', { cause: err });
  }
  const { GIFEncoder, quantize, applyPalette } = gifenc;

  const fps = options?.fps ?? 25;
  const dpi = options?.dpi ?? 2;
  const shouldEmbed = options?.embedFonts ?? true;
  const { width, height } = getSVGDimensions(svgElement);
  if (!width || !height) {
    throw new Error(`SVG has zero dimensions (width=${width}, height=${height})`);
  }

  // Resolve timing from the config with defaults as a fallback. The stamped
  // custom properties on the SVG (read by scanEntrance) take precedence,
  // since they are exactly what the live CSS used.
  const enter = animation?.enter || undefined;
  const easeKind: AnimationEase = enter?.ease ?? 'smooth';

  // Build one font-embedded clone that represents the FINAL frame; every frame
  // derives from it, so fonts are embedded exactly once.
  const clone = svgElement.cloneNode(true) as SVGElement;
  // Inline the theme style block so class-based chrome fills survive the detach
  // from the page stylesheet (metrics, eyebrow dot, legend). No-op when undefined.
  injectThemeStyleBlock(clone, options?.theme);
  if (shouldEmbed) {
    await embedFonts(clone);
  }
  const scan = scanEntrance(clone);
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

  // Total capture window: explicit override, else the choreography table's end
  // for the elements present (the same figure cleanup uses) plus a short tail.
  const totalMs = options?.durationMs ?? scanEntranceEndMs(scan, phase) + CAPTURE_TAIL_MS;
  const frameDelay = Math.round(1000 / fps);
  const totalFrames = Math.max(1, Math.round((totalMs / 1000) * fps));

  // Loop → gifenc repeat: play-once (-1), forever (0), or explicit count.
  const repeat = resolveRepeat(options?.loop);

  // GIF can't carry partial alpha, so fill an opaque background before drawing
  // each frame (else a transparent chart composites onto black). Runs before
  // ctx.scale, so paint the raw device-pixel canvas size.
  // The theme background is the fallback: canvas mark mode suppresses the SVG
  // background rect, so there's nothing in the markup to read it from.
  const bgColor =
    options?.backgroundColor ??
    getSVGBackgroundColor(svgElement, options?.theme?.colors.background);
  const fillBackground = (ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement): void => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cv.width, cv.height);
  };

  const gif = GIFEncoder();

  // Derive ONE global palette from the settled frame (most complete colors)
  // and reuse it for every frame, so colors stay stable and the file stays
  // small. gifenc writes the global color table from the palette on the first
  // frame; later frames reuse it.
  let globalPalette: number[][] = [];
  await seedPalette(clone, targets, width, height, dpi, fillBackground, (data) => {
    globalPalette = quantize(data, 256);
  });

  let frameWritten = 0;
  const writeFrame = async (nowMs: number | null): Promise<void> => {
    if (nowMs === null) {
      for (const t of targets) clearFrameState(t);
    } else {
      for (const t of targets) applyFrameState(t, nowMs, easeKind, phase);
    }
    const svgString = ensureSVGDimensions(exportSVG(clone), width, height);
    const canvas = await rasterizeSVGToCanvas(svgString, width, height, dpi, fillBackground);
    const index = applyPalette(readCanvasSRGB(canvas), globalPalette);
    // `repeat` is only meaningful on the first frame (it writes the loop
    // extension); passing it later is ignored by gifenc.
    gif.writeFrame(index, canvas.width, canvas.height, {
      palette: globalPalette,
      delay: frameDelay,
      ...(frameWritten === 0 ? { repeat } : {}),
    });
    frameWritten++;
  };

  for (let i = 0; i < totalFrames; i++) {
    await writeFrame((i / fps) * 1000);
  }
  // Final settled frame the GIF holds on.
  await writeFrame(null);

  gif.finish();
  // gifenc types bytes() as Uint8Array<ArrayBufferLike>; BlobPart wants a view
  // over a plain ArrayBuffer. The runtime value is a valid BufferSource, so the
  // cast is safe — it only bridges the ArrayBufferLike/ArrayBuffer lib mismatch.
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

/**
 * Render the settled clone once (no per-frame state) to derive the palette
 * source, without writing a frame. Restores frame state afterward.
 */
async function seedPalette(
  clone: SVGElement,
  targets: AnimatedTarget[],
  width: number,
  height: number,
  dpi: number,
  prepare: (ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement) => void,
  use: (data: Uint8ClampedArray) => void,
): Promise<void> {
  for (const t of targets) clearFrameState(t);
  const svgString = ensureSVGDimensions(exportSVG(clone), width, height);
  const canvas = await rasterizeSVGToCanvas(svgString, width, height, dpi, prepare);
  use(readCanvasSRGB(canvas));
}
