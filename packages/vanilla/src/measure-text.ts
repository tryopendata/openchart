/**
 * Canvas-backed text measurement factory.
 *
 * Shared by mount.ts (charts) and sankey-mount.ts (sankey diagrams) so both
 * pipelines get accurate browser-measured text widths instead of the heuristic
 * fallback. Falls back to the heuristic when canvas isn't available (e.g. SSR).
 */

import type { MeasureTextFn } from '@opendata-ai/openchart-core';

export function createMeasureText(): MeasureTextFn {
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
      return { width: text.length * fontSize * 0.6, height: fontSize * 1.2 };
    }

    const weight = fontWeight ?? 400;
    ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
    const metrics = ctx.measureText(text);
    return {
      width: metrics.width,
      height: fontSize * 1.2,
    };
  };
}
