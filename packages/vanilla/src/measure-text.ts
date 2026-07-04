/**
 * Canvas-backed text measurement factory.
 *
 * Shared by mount.ts (charts) and sankey-mount.ts (sankey diagrams) so both
 * pipelines get accurate browser-measured text widths instead of the heuristic
 * fallback. Falls back to the heuristic when canvas isn't available (e.g. SSR).
 *
 * The font family is passed in (resolved from the container's --oc-font-family
 * or the spec theme) rather than hardcoded, so measurement matches what the SVG
 * text actually renders with. This matters on real devices where the primary
 * webfont (e.g. Inter) loads late: measuring against the wrong font produces
 * wrong widths and mangles layout.
 */

import type { MeasureTextFn } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';

const DEFAULT_FONT_FAMILY = 'Inter, sans-serif';

export function createMeasureText(fontFamily: string = DEFAULT_FONT_FAMILY): MeasureTextFn {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  return (
    text: string,
    fontSize: number,
    fontWeight?: number,
  ): { width: number; height: number } => {
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    if (!ctx) {
      // Fallback: heuristic estimation
      return {
        width: estimateTextWidth(text, fontSize, fontWeight ?? 400),
        height: fontSize * 1.2,
      };
    }

    const weight = fontWeight ?? 400;
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    return {
      width: metrics.width,
      height: fontSize * 1.2,
    };
  };
}

/**
 * Resolve the font family a container's SVG text will actually render with.
 *
 * Reads the --oc-font-family custom property (set by tokens.css once .oc-root
 * is applied, or overridden per-spec by the theme resolver), falling back to
 * the container's computed fontFamily, then to the default Inter stack. Returns
 * the previous hardcoded stack when there is no DOM (SSR) or no computed style.
 */
export function resolveFontFamily(container: HTMLElement): string {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return DEFAULT_FONT_FAMILY;
  }
  try {
    const style = getComputedStyle(container);
    const custom = style.getPropertyValue('--oc-font-family').trim();
    if (custom) return custom;
    const computed = style.fontFamily?.trim();
    if (computed) return computed;
  } catch {
    // getComputedStyle can throw on detached nodes in some engines; fall through.
  }
  return DEFAULT_FONT_FAMILY;
}

/**
 * The first family in a CSS font stack, with surrounding quotes stripped, e.g.
 * `'"Inter Variable", Inter, sans-serif'` -> `Inter Variable`. Used to build a
 * representative check string for document.fonts.check().
 */
export function primaryFontName(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '').trim();
}

/**
 * True when the primary font of the resolved stack is not yet loaded and a
 * later document.fonts.ready may change text metrics. False when fonts are
 * ready, unavailable (SSR / no FontFaceSet), or the primary is a generic family.
 */
export function fontsPending(fontFamily: string): boolean {
  if (typeof document === 'undefined') return false;
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.check !== 'function') return false;
  const name = primaryFontName(fontFamily);
  if (!name) return false;
  const generics = new Set([
    'sans-serif',
    'serif',
    'monospace',
    'system-ui',
    'cursive',
    'fantasy',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
  ]);
  if (generics.has(name.toLowerCase())) return false;
  try {
    return !fonts.check(`12px "${name}"`);
  } catch {
    return false;
  }
}

/**
 * Run `onReady` exactly once after webfonts finish loading, if they were
 * pending at call time. `isAlive` is checked before invoking so a destroyed
 * chart is never re-rendered. Returns the initial pending state so callers can
 * set their `ocFontsState` dataset flag. No-op (returns false) under SSR or
 * when the primary font is already loaded.
 */
export function scheduleFontReload(
  fontFamily: string,
  isAlive: () => boolean,
  onReady: () => void,
): boolean {
  if (!fontsPending(fontFamily)) return false;
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.ready) return false;
  fonts.ready.then(() => {
    if (isAlive()) onReady();
  });
  return true;
}
