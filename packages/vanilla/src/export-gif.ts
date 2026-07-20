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
 * This mirrors the entrance keyframes in `packages/core/src/styles/*.css`:
 * bars clip bottom-up / left-right, line/area clip left-right, arcs and points
 * fade. Only the entrance is reproduced; the on-screen CSS animation is
 * untouched. `gifenc` is an optional peer dependency, loaded dynamically.
 */

import type { AnimationEase, ResolvedAnimation } from '@opendata-ai/openchart-core';
import {
  embedFonts,
  ensureSVGDimensions,
  exportSVG,
  getSVGBackgroundColor,
  getSVGDimensions,
  rasterizeSVGToCanvas,
} from './export';

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
   * Explicit capture duration in ms. Defaults to the resolved animation total
   * (enter duration + last element's stagger delay + a small tail).
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
}

/** Which visual property an element's entrance keyframe animates. */
export type AnimationKind = 'bar-vertical' | 'bar-horizontal' | 'line-area' | 'fade';

export interface AnimatedTarget {
  /** The element in the CLONE that receives per-frame inline styles. */
  el: SVGElement;
  kind: AnimationKind;
  /** Start offset in ms (stagger * mark index). */
  startMs: number;
  /** Duration of this element's own animation in ms. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Easing — replicate --oc-ease-smooth (CSS linear() sample points)
// ---------------------------------------------------------------------------

/**
 * Sample points of the `--oc-ease-smooth` token (see tokens.css). CSS
 * `linear()` interpolates piecewise-linearly between evenly-spaced samples, so
 * we reproduce it exactly rather than approximating with a cubic-bezier.
 */
export const EASE_SMOOTH_SAMPLES = [
  0, 0.157, 0.438, 0.64, 0.766, 0.85, 0.906, 0.941, 0.964, 0.978, 0.988, 0.994, 0.998, 1,
];

/** Piecewise-linear evaluation of a CSS linear() sample array at t in [0,1]. */
export function evalLinearSamples(samples: number[], t: number): number {
  if (t <= 0) return samples[0];
  if (t >= 1) return samples[samples.length - 1];
  const scaled = t * (samples.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  return samples[i] + (samples[i + 1] - samples[i]) * frac;
}

/** Ease a normalized progress value. Only 'smooth' is sample-accurate today. */
function ease(p: number, _kind: AnimationEase): number {
  // The entrance rules use --oc-ease-smooth (or fall back to it) in all cases
  // GIF export handles today. Snappy/others could add their own samples later.
  return evalLinearSamples(EASE_SMOOTH_SAMPLES, p);
}

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

/**
 * Classify an animated element (identified by `data-animation-index`) into the
 * keyframe it plays, and return the element that should receive inline styles.
 * Returns null only when a bar group has no shape child to clip. Unrecognized
 * mark types (map/tilemap/table/text) fall back to a plain opacity fade rather
 * than a hard pop-in — see the generic case at the end.
 */
export function classifyTarget(
  groupOrEl: SVGElement,
): { el: SVGElement; kind: AnimationKind } | null {
  const cls = groupOrEl.getAttribute('class') ?? '';

  // Bars: CSS animates the child <rect>; clip + fade. Orient on the group.
  if (cls.includes('oc-mark-rect') || cls.includes('oc-mark-bar')) {
    const rect = groupOrEl.querySelector('rect') ?? groupOrEl.querySelector('path');
    if (!rect) return null;
    const horizontal = groupOrEl.getAttribute('data-orient') === 'horizontal';
    return { el: rect as SVGElement, kind: horizontal ? 'bar-horizontal' : 'bar-vertical' };
  }

  // Line/area: the whole group clips left-to-right + fades.
  if (cls.includes('oc-mark-line') || cls.includes('oc-mark-area')) {
    return { el: groupOrEl, kind: 'line-area' };
  }

  // Arcs and points: fade only (scale breaks arc/point positioning, so the CSS
  // uses a plain opacity fade too).
  if (
    cls.includes('oc-mark-arc') ||
    cls.includes('oc-mark-point') ||
    cls.includes('oc-mark-circle')
  ) {
    return { el: groupOrEl, kind: 'fade' };
  }

  // Everything else (text labels, rules, ticks, map/tilemap/table marks) is a
  // plain fade; treat generically so the frame isn't a hard pop-in.
  return { el: groupOrEl, kind: 'fade' };
}

/**
 * Build the list of animated targets from a cloned SVG, pairing each element
 * with its timing. Elements carry `data-animation-index` (the mark index that
 * drives stagger) stamped by the renderer.
 */
function collectTargets(
  clone: SVGElement,
  enterDurationMs: number,
  staggerMs: number,
): AnimatedTarget[] {
  const els = clone.querySelectorAll<SVGElement>('[data-animation-index]');
  const targets: AnimatedTarget[] = [];

  for (const el of els) {
    const classified = classifyTarget(el);
    if (!classified) continue;
    const idx = parseInt(el.getAttribute('data-animation-index') ?? '0', 10) || 0;
    // Points animate at 40% of the base duration (matches animation.css).
    const isPoint =
      classified.kind === 'fade' && /oc-mark-(point|circle)/.test(el.getAttribute('class') ?? '');
    // Points on line/area charts start 35% of a duration in, so they pop as the
    // line draws through them (the `.oc-mark-line ~ circle.oc-mark-point` rule).
    const lineOffset = isPoint && hasLineAreaSibling(el) ? enterDurationMs * 0.35 : 0;
    targets.push({
      el: classified.el,
      kind: classified.kind,
      startMs: staggerMs * idx + lineOffset,
      durationMs: isPoint ? enterDurationMs * 0.4 : enterDurationMs,
    });
  }

  return targets;
}

/**
 * Replicate the CSS sibling combinator `.oc-mark-line ~ circle.oc-mark-point`:
 * true when a line or area mark precedes this point among its siblings.
 */
function hasLineAreaSibling(point: SVGElement): boolean {
  let sib = point.previousElementSibling;
  while (sib) {
    const cls = sib.getAttribute('class') ?? '';
    if (cls.includes('oc-mark-line') || cls.includes('oc-mark-area')) return true;
    sib = sib.previousElementSibling;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Per-frame interpolation
// ---------------------------------------------------------------------------

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

/**
 * Apply the interpolated entrance state for a target at absolute time `nowMs`,
 * writing inline `clip-path`/`opacity` so it survives serialization.
 */
export function applyFrameState(
  target: AnimatedTarget,
  nowMs: number,
  easeKind: AnimationEase,
): void {
  const p = clamp01((nowMs - target.startMs) / target.durationMs);
  const eased = ease(p, easeKind);
  const style = target.el.style;

  switch (target.kind) {
    case 'bar-vertical': {
      // oc-enter-bar: clip-path inset(100%→0 from top) + opacity (full by 75%).
      const inset = (1 - eased) * 100;
      style.clipPath = `inset(${inset}% 0 0 0)`;
      style.opacity = String(clamp01(p / 0.75));
      break;
    }
    case 'bar-horizontal': {
      // oc-enter-bar-h: clip-path inset(0 100%→0 from right) + opacity.
      const inset = (1 - eased) * 100;
      style.clipPath = `inset(0 ${inset}% 0 0)`;
      style.opacity = String(clamp01(p / 0.75));
      break;
    }
    case 'line-area': {
      // oc-enter-line: clip-path inset(0 100%→0 from right); opacity full by 15%.
      const inset = (1 - eased) * 100;
      style.clipPath = `inset(0 ${inset}% 0 0)`;
      style.opacity = String(clamp01(p / 0.15));
      break;
    }
    case 'fade': {
      // oc-enter-fade-only: opacity 0→1.
      style.opacity = String(eased);
      break;
    }
  }
}

/** Clear any inline entrance styles so the settled frame renders at rest. */
function clearFrameState(target: AnimatedTarget): void {
  const style = target.el.style;
  style.clipPath = '';
  style.opacity = '';
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

  // Resolve timing from the config (exact) with defaults as a fallback.
  const enter = animation?.enter;
  const enterDurationMs = enter?.duration ?? 600;
  const staggerMs = enter?.staggerDelay ?? 0;
  const easeKind: AnimationEase = enter?.ease ?? 'smooth';

  // Build one font-embedded clone that represents the FINAL frame; every frame
  // derives from it, so fonts are embedded exactly once.
  const clone = svgElement.cloneNode(true) as SVGElement;
  if (shouldEmbed) {
    await embedFonts(clone);
  }
  const targets = collectTargets(clone, enterDurationMs, staggerMs);

  // Total capture window: explicit override, else the animation total. Mirrors
  // computeAnimationDuration (animation.ts): the window must cover the last
  // mark's stagger + its own duration AND the annotation reveal, which animates
  // at enterDuration + annotationDelay. Without the annotationDelay term, charts
  // with annotations get cut off before the annotations finish fading in.
  const annotationDelay = animation?.annotationDelay ?? 0;
  const lastMarkEnd = targets.reduce(
    (m, t) => Math.max(m, t.startMs + t.durationMs),
    enterDurationMs,
  );
  const lastEnd = Math.max(lastMarkEnd, enterDurationMs + annotationDelay);
  const totalMs = options?.durationMs ?? lastEnd + 300;
  const frameDelay = Math.round(1000 / fps);
  const totalFrames = Math.max(1, Math.round((totalMs / 1000) * fps));

  // Loop → gifenc repeat: play-once (-1), forever (0), or explicit count.
  const repeat = resolveRepeat(options?.loop);

  // GIF can't carry partial alpha, so fill an opaque background before drawing
  // each frame (else a transparent chart composites onto black). Runs before
  // ctx.scale, so paint the raw device-pixel canvas size.
  const bgColor = options?.backgroundColor ?? getSVGBackgroundColor(svgElement);
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
      for (const t of targets) applyFrameState(t, nowMs, easeKind);
    }
    const svgString = ensureSVGDimensions(exportSVG(clone), width, height);
    const canvas = await rasterizeSVGToCanvas(svgString, width, height, dpi, fillBackground);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    // GIF is sRGB-only and can't carry a color profile. The export canvas may be
    // display-p3 (so PNG/JPG embed a profile), so read back in sRGB explicitly —
    // gifenc's quantizer assumes sRGB bytes, and feeding it P3-encoded data would
    // shift/desaturate the GIF. The browser converts P3→sRGB on readback.
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height, {
      colorSpace: 'srgb',
    });
    const index = applyPalette(data, globalPalette);
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
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  // Read back in sRGB (the export canvas may be display-p3); the palette must be
  // quantized from sRGB bytes to match gifenc's assumption. See writeFrame.
  use(ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb' }).data);
}
