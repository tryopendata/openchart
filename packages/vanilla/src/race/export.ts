import type { RaceLayout } from '@opendata-ai/openchart-core';
import { embedFonts } from '../export';
import type { GIFExportOptions } from '../export-gif';
import { encodeSVGFrames } from '../gif-frame-encoder';
import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import { prepareSettledExportTheme } from '../theme-style-block';
import type { RaceShell } from './shell';

interface RaceExportView {
  layout: RaceLayout;
  shell: Pick<RaceShell, 'svg'>;
  mountExportRenderer(svg: SVGSVGElement): { draw(t: number): void; destroy(): void };
  signal?: AbortSignal;
}

const MAX_FRAMES = 1200;
const END_HOLD_MS = 1500;
const MIN_DELAY_CS = 2; // Browsers can display a shorter delay as 100 ms.
const MAX_DELAY_CS = 0xffff;

const FRAME_STYLE_PROPERTIES = [
  'fill',
  'stroke',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-variant-numeric',
  'letter-spacing',
  'dominant-baseline',
  'direction',
] as const;

function raceClass(element: Element): string | undefined {
  return Array.from(element.classList).find((name) => name.startsWith('oc-race-'));
}

function snapshotRaceStyles(source: SVGElement, fallbackFont: string) {
  const doc = source.ownerDocument;
  const win = doc.defaultView;
  const fonts = new Map<string, SVGTextElement>();
  const rules: string[] = [];
  if (!win) return { css: '', fonts: [] };

  const samples = new Map<string, Element>([['.oc-race', source]]);
  for (const element of source.querySelectorAll('.oc-race-mark, .oc-race-mark *')) {
    const role = raceClass(element);
    if (role) {
      if (!samples.has(`.${role}`)) samples.set(`.${role}`, element);
    } else if (element.localName === 'line' || element.localName === 'text') {
      const group = element.closest('[class*="oc-race-"]');
      const groupRole = group && raceClass(group);
      if (!groupRole) continue;
      const selector = `.${groupRole} ${element.localName}`;
      if (!samples.has(selector)) samples.set(selector, element);
    }
  }

  for (const [selector, element] of samples) {
    const computed = win.getComputedStyle(element);
    const declarations: string[] = [];
    for (const property of FRAME_STYLE_PROPERTIES) {
      // The renderer updates these paint attributes as the race advances.
      if (
        (property === 'fill' || property === 'stroke' || property === 'opacity') &&
        element.hasAttribute(property)
      )
        continue;
      const value = computed.getPropertyValue(property);
      if (property === 'dominant-baseline') {
        // A baseline inherited from renderer markup belongs to that subtree.
        // Applying the y-axis baseline to all axis labels moves the x-axis labels.
        const baseline = element.closest('[dominant-baseline]')?.getAttribute(property) ?? 'auto';
        if (value === baseline) continue;
      }
      if (value) declarations.push(`${property}: ${value};`);
    }
    if (declarations.length) rules.push(`${selector} { ${declarations.join(' ')} }`);

    const family = computed.fontFamily || fallbackFont;
    const weight = computed.fontWeight;
    const key = `${family}:${weight}`;
    if (fonts.has(key)) continue;
    const probe = doc.createElementNS(SVG_NS, 'text');
    probe.style.fontFamily = family;
    probe.style.fontWeight = weight;
    fonts.set(key, probe);
  }
  return { css: rules.join('\n'), fonts: [...fonts.values()] };
}

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
  { layout, shell, mountExportRenderer, signal }: RaceExportView,
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
  const end = layout.periods.length - 1;
  const count = Math.min(
    MAX_FRAMES - 1,
    Math.floor(durationCs / MIN_DELAY_CS),
    Math.max(minimumFrames, Math.ceil((playback.durationMs / 1000) * fps)),
  );
  // Snapshot the live SVG and theme before yielding to the optional encoder import.
  const svg = shell.svg.ownerDocument.importNode(shell.svg, true);
  prepareSettledExportTheme(shell.svg, svg, theme);
  svg.style.fontFamily =
    svg.style.getPropertyValue('--oc-font-family').trim() || theme.fonts.family;
  const { css, fonts } = snapshotRaceStyles(shell.svg, svg.style.fontFamily);
  svg.querySelector('style[data-oc-theme]')?.append(`\n${css}`);
  const surface = svg.style.getPropertyValue('--oc-bg').trim();
  const backgroundColor =
    surface && !/^(none|transparent|currentcolor|url\()/i.test(surface)
      ? surface
      : theme.colors.neutral.surface;
  let renderer = mountExportRenderer(svg);

  const encoding = encodeSVGFrames(
    svg,
    { dpi: 1, loop: playback.loop, backgroundColor },
    async () => {
      renderer.draw(end);
      // Font discovery reads inline declarations. Supply the live CSS font usage
      // during discovery without changing the exported mark attributes.
      svg.append(...fonts);
      try {
        await embedFonts(svg);
      } finally {
        for (const font of fonts) font.remove();
      }
      return {
        svg,
        count,
        globalPalette: {
          swatches: paletteSwatches(svg, layout.colors),
          startFrames() {
            // Rebuild the keyed renderer so the seed cannot affect paint order at t = 0.
            renderer.destroy();
            renderer = mountExportRenderer(svg);
          },
        },
        draw(index) {
          if (index === null) {
            renderer.draw(end);
            return END_HOLD_MS;
          }
          // Sample at the displayed start time, including the rounding to centiseconds.
          const before = Math.round((index / count) * durationCs);
          const after = Math.round(((index + 1) / count) * durationCs);
          renderer.draw((before / durationCs) * end);
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
