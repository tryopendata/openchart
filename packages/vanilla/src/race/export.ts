import type { RaceLayout } from '@opendata-ai/openchart-core';
import { type RaceModel, raceGeometryAt } from '@opendata-ai/openchart-engine';
import { embedFonts } from '../export';
import type { GIFExportOptions } from '../export-gif';
import { encodeSVGFrames } from '../gif-frame-encoder';
import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import { prepareSettledExportTheme } from '../theme-style-block';
import { RACE_RENDERERS } from './renderers';
import type { RaceShell } from './shell';

interface RaceExportView {
  model: RaceModel;
  layout: RaceLayout;
  shell: Pick<RaceShell, 'svg'>;
  idScope: string;
  signal?: AbortSignal;
}

const MAX_FRAMES = 1200;
const END_HOLD_MS = 1500;
const MIN_DELAY_CS = 2; // Browsers can display a shorter delay as 100 ms.
const MAX_DELAY_CS = 0xffff;

// The shared theme block covers chrome. The mark rules in race.css also need
// to travel with the serialized SVG, which has no access to the page stylesheet.
const RACE_FRAME_STYLES = `
.oc-race-axis line { stroke: var(--oc-gridline); }
.oc-race-axis text, .oc-race-summary { fill: var(--oc-text-muted); }
.oc-race-summary { font-size: var(--oc-source-size); }
.oc-race-rows text { fill: var(--oc-text); font-size: var(--oc-body-size); }
.oc-race-period { fill: var(--oc-text-faint); }
.oc-race-line-labels { dominant-baseline: central; font-size: var(--oc-body-size); }
`;

function paletteSwatches(svg: SVGElement, colors: readonly string[]): SVGElement {
  // Set aside most of the palette for series colors and keep space for chrome and antialiasing.
  const distinct = Array.from(new Set(colors)).slice(0, 224);
  const doc = svg.ownerDocument;
  const swatches = doc.createElementNS(SVG_NS, 'svg');
  swatches.style.cssText = svg.style.cssText;
  swatches.style.removeProperty('width');
  swatches.style.removeProperty('height');
  setAttrs(swatches, { width: distinct.length, height: 1 });
  for (const [x, fill] of distinct.entries()) {
    const swatch = doc.createElementNS(SVG_NS, 'rect');
    setAttrs(swatch, { x, y: 0, width: 1, height: 1, fill });
    swatches.append(swatch);
  }
  return swatches;
}

/** Render the mounted bar or line layout from the first period through the end hold. */
export async function exportRaceGIF(
  { model, layout, shell, idScope, signal }: RaceExportView,
  options?: Pick<GIFExportOptions, 'fps'>,
): Promise<Blob> {
  if (layout.mark === 'table') throw new Error('GIF export supports the bar and line marks');
  signal?.throwIfAborted();
  const fps = options?.fps ?? 25;
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('GIF export fps must be finite and greater than zero');
  }

  const { theme, playback } = layout;
  const durationCs = Math.max(MIN_DELAY_CS, Math.round(playback.durationMs / 10));
  const minimumFrames = Math.ceil(durationCs / MAX_DELAY_CS);
  if (minimumFrames >= MAX_FRAMES) {
    throw new RangeError('Race duration exceeds the GIF limit. Shorten the race duration.');
  }
  const end = model.timeline.periodCount - 1;
  const count = Math.min(
    MAX_FRAMES - 1,
    Math.floor(durationCs / MIN_DELAY_CS),
    Math.max(minimumFrames, Math.ceil((playback.durationMs / 1000) * fps)),
  );
  // Snapshot the live SVG and theme before yielding to the optional encoder import.
  const svg = shell.svg.ownerDocument.importNode(shell.svg, true);
  const host = svg.querySelector<SVGGElement>('g.oc-race-mark');
  if (!host) throw new Error('The race SVG has no mark host');

  function mountRenderer(markHost: SVGGElement) {
    const bar = layout.mark === 'bar' && RACE_RENDERERS.bar?.(markHost, layout.static, idScope);
    const line = layout.mark === 'line' && RACE_RENDERERS.line?.(markHost, layout.static, idScope);
    if (!bar && !line) throw new Error(`Race mark "${layout.mark}" is not registered`);
    // Font discovery reads the weight from markup.
    markHost.querySelector('.oc-race-period')?.setAttribute('font-weight', '600');
    return {
      draw(t: number) {
        const geometry = raceGeometryAt(model, layout, t);
        if (bar && geometry.mark === 'bar') bar.draw(geometry);
        if (line && geometry.mark === 'line') line.draw(geometry);
      },
      destroy() {
        if (bar) bar.destroy();
        if (line) line.destroy();
      },
    };
  }
  host.replaceChildren();

  prepareSettledExportTheme(shell.svg, svg, theme);
  const style = svg.querySelector('style[data-oc-theme]');
  if (style?.textContent) {
    style.textContent =
      style.textContent.replace('svg.oc-chart', 'svg.oc-race') + RACE_FRAME_STYLES;
  }
  // Font discovery reads the literal family from markup.
  svg.style.fontFamily =
    svg.style.getPropertyValue('--oc-font-family').trim() || theme.fonts.family;
  const surface = svg.style.getPropertyValue('--oc-bg').trim();
  const backgroundColor =
    surface && !/^(none|transparent|currentcolor|url\()/i.test(surface)
      ? surface
      : theme.colors.neutral.surface;
  // Add the renderer's defs after the shared theme and fonts' defs.
  let renderer = mountRenderer(host);

  const encoding = encodeSVGFrames(
    svg,
    { loop: playback.loop, backgroundColor },
    async () => {
      renderer.draw(end);
      await embedFonts(svg);
      return {
        svg,
        count,
        globalPalette: {
          swatches: paletteSwatches(svg, layout.colors),
          startFrames() {
            // Rebuild the keyed renderer so the seed cannot affect paint order at t = 0.
            renderer.destroy();
            renderer = mountRenderer(host);
          },
        },
        draw(index) {
          if (index === null) {
            renderer.draw(end);
            return END_HOLD_MS;
          }
          renderer.draw((index / count) * end);
          // GIF delays are centiseconds. Round elapsed time to avoid accumulating drift.
          const before = Math.round((index / count) * durationCs);
          const after = Math.round(((index + 1) / count) * durationCs);
          return (after - before) * 10;
        },
      };
    },
    signal,
  );
  if (!signal) return encoding;

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([encoding, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
