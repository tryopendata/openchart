/**
 * Lazy entry to the animated GIF export.
 *
 * The dynamic import keeps the GIF encoder (the optional `gifenc` peer) and
 * the frame sampler out of the core bundle: only consumers who export GIFs
 * load that chunk. Every mount that offers `export('gif')` goes through here.
 */

import type { ResolvedAnimation } from '@opendata-ai/openchart-core';
import type { GIFExportOptions } from './export-gif';

/** Encode `svg`'s entrance as an animated GIF, loading the encoder on first use. */
export function exportEntranceGIF(
  svg: SVGElement,
  animation: ResolvedAnimation | undefined,
  options?: GIFExportOptions,
): Promise<Blob> {
  return import('./export-gif').then(({ exportGIF }) => exportGIF(svg, animation, options));
}
