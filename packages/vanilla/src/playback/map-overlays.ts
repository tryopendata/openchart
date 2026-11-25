/**
 * Drawing a map playback's overlays (the period label) into a map SVG. Map layouts carry
 * them in `playbackOverlays`; the frame writer then updates each by its `data-key`.
 */
import type { TextMarkLayout } from '@opendata-ai/openchart-core';
import type { PlaybackOverlayLayout } from '@opendata-ai/openchart-engine';
import { createRenderContext, type RenderContext } from '../render-context';
import { createSVGElement } from '../renderers/svg-dom';

/** Class on the group holding the overlays. */
export const MAP_OVERLAY_CLASS = 'oc-playback-overlays';

function renderOverlayText(mark: TextMarkLayout, ctx: RenderContext): SVGElement {
  const text = createSVGElement('text', ctx.factory);
  text.setAttribute('class', 'oc-playback-period');
  if (mark.key) text.setAttribute('data-key', mark.key);
  text.setAttribute('x', String(mark.x));
  text.setAttribute('y', String(mark.y));
  text.setAttribute('font-size', String(mark.fontSize));
  text.setAttribute('text-anchor', mark.textAnchor);
  if (mark.dominantBaseline) text.setAttribute('dominant-baseline', mark.dominantBaseline);
  if (mark.fontWeight) text.setAttribute('font-weight', String(mark.fontWeight));
  if (mark.fontFamily) text.setAttribute('font-family', mark.fontFamily);
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', mark.fill);
  if (mark.aria?.decorative) text.setAttribute('aria-hidden', 'true');
  text.textContent = mark.text;
  return text;
}

/**
 * Append a layout's playback overlays to `parent` in one decorative group. Does nothing for
 * a layout without overlays.
 */
export function renderMapOverlays(
  parent: SVGElement,
  layout: PlaybackOverlayLayout,
  ctx: RenderContext = createRenderContext(),
): void {
  const overlays = layout.playbackOverlays;
  if (!overlays?.length) return;
  const group = createSVGElement('g', ctx.factory);
  group.setAttribute('class', MAP_OVERLAY_CLASS);
  group.setAttribute('aria-hidden', 'true');
  for (const mark of overlays) group.appendChild(renderOverlayText(mark, ctx));
  parent.appendChild(group);
}
