/**
 * Frame-stepped GIF export for playback views (races, playback charts and maps).
 * It clones the live SVG once, snapshots the page styles the clone would lose when
 * detached, then has the caller draw each sampled playhead onto the clone.
 */
import { embedFonts } from '../export';
import type { GIFExportOptions } from '../export-gif';
import { encodeSVGFrames } from '../gif-frame-encoder';
import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import { prepareSettledExportTheme } from '../theme-style-block';

/** A mounted playback view to capture frame by frame. */
export interface PlaybackGIFSource {
  /** The live SVG. It is cloned once; frames are drawn onto the clone. */
  svg: SVGSVGElement;
  /** Number of periods; frames sample t in [0, periodCount - 1]. */
  periodCount: number;
  /** Draw the playhead `t` (continuous period index) onto `frame`, the cloned SVG. */
  draw(t: number, frame: SVGSVGElement): void;
  /** Run length at 1×, sampled at `fps`. */
  durationMs: number;
  /** Delay of the settled final frame. */
  holdEndMs: number;
  /** Class selectors whose computed text and paint styles are snapshotted into the clone, e.g. `.oc-race-mark`. */
  styleSelectors: string[];
  /** Colors reserved in the global palette so series colors survive quantization. */
  paletteSeed: readonly string[];
  /** Rejects the export when aborted. */
  signal?: AbortSignal;
}

/** Options playback export honors. `dpi` defaults to 2 and `fps` to 25, as for chart GIFs. */
export type PlaybackGIFOptions = Pick<
  GIFExportOptions,
  'fps' | 'dpi' | 'loop' | 'embedFonts' | 'backgroundColor' | 'theme'
>;

const DEFAULT_FPS = 25;
const MAX_FRAMES = 1200;
const MIN_DELAY_CS = 2; // Browsers can display a shorter delay as 100 ms.
const MAX_DELAY_CS = 0xffff;
// Set aside most of the palette for series colors and keep space for chrome and antialiasing.
const MAX_SEEDED_COLORS = 224;
const CLASS_NAMESPACE = 'oc-';

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
const PAINT_PROPERTIES: ReadonlySet<string> = new Set(['fill', 'stroke', 'opacity']);

interface FramePlan {
  /** Frames sampled across the run, before the hold. */
  count: number;
  durationCs: number;
}

/** Pick the frame count for a run, within GIF frame and delay limits. */
function planFrames(durationMs: number, fps: number): FramePlan {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('GIF export fps must be finite and greater than zero');
  }
  const durationCs = Math.max(MIN_DELAY_CS, Math.round(durationMs / 10));
  const minimumFrames = Math.ceil(durationCs / MAX_DELAY_CS);
  if (minimumFrames >= MAX_FRAMES) {
    throw new RangeError('Playback duration exceeds the GIF limit. Shorten the duration.');
  }
  const count = Math.min(
    MAX_FRAMES - 1,
    Math.floor(durationCs / MIN_DELAY_CS),
    Math.max(minimumFrames, Math.ceil((durationMs / 1000) * fps)),
  );
  return { count, durationCs };
}

/** The library class that names an element's role, e.g. `oc-race-period`. */
function roleClass(element: Element): string | undefined {
  return Array.from(element.classList).find((name) => name.startsWith(CLASS_NAMESPACE));
}

/** One sample element per selector, in document order: the root, roles, then classless text and lines. */
function collectStyleSamples(source: SVGElement, styleSelectors: string[]): Map<string, Element> {
  const samples = new Map<string, Element>();
  const rootRole = roleClass(source);
  if (rootRole) samples.set(`.${rootRole}`, source);
  if (!styleSelectors.length) return samples;

  const query = styleSelectors.flatMap((selector) => [selector, `${selector} *`]).join(', ');
  for (const element of source.querySelectorAll(query)) {
    const role = roleClass(element);
    if (role) {
      if (!samples.has(`.${role}`)) samples.set(`.${role}`, element);
      continue;
    }
    if (element.localName !== 'line' && element.localName !== 'text') continue;
    let group = element.parentElement;
    while (group && !roleClass(group)) group = group.parentElement;
    const groupRole = group && roleClass(group);
    if (!groupRole) continue;
    const selector = `.${groupRole} ${element.localName}`;
    if (!samples.has(selector)) samples.set(selector, element);
  }
  return samples;
}

/** The computed declarations a detached frame needs to match the sampled element. */
function frameDeclarations(element: Element, computed: CSSStyleDeclaration): string[] {
  const declarations: string[] = [];
  for (const property of FRAME_STYLE_PROPERTIES) {
    // The caller's draw updates these paint attributes as playback advances.
    if (PAINT_PROPERTIES.has(property) && element.hasAttribute(property)) continue;
    const value = computed.getPropertyValue(property);
    if (property === 'dominant-baseline') {
      // A baseline inherited from renderer markup belongs to that subtree.
      // Applying the y-axis baseline to all axis labels moves the x-axis labels.
      const baseline = element.closest('[dominant-baseline]')?.getAttribute(property) ?? 'auto';
      if (value === baseline) continue;
    }
    if (value) declarations.push(`${property}: ${value};`);
  }
  return declarations;
}

/** Snapshot sampled computed styles as CSS, plus one probe per font the samples use. */
function snapshotStyles(source: SVGElement, styleSelectors: string[], fallbackFont: string) {
  const doc = source.ownerDocument;
  const win = doc.defaultView;
  if (!win) return { css: '', fonts: [] };

  const fonts = new Map<string, SVGTextElement>();
  const rules: string[] = [];
  for (const [selector, element] of collectStyleSamples(source, styleSelectors)) {
    const computed = win.getComputedStyle(element);
    const declarations = frameDeclarations(element, computed);
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

/** A strip of one-pixel swatches whose colors the encoder reserves in its palette. */
function paletteSwatches(svg: SVGElement, colors: readonly string[]): SVGElement {
  const distinct = Array.from(new Set(colors)).slice(0, MAX_SEEDED_COLORS);
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

/** Clone the live SVG with its theme, font and snapshotted styles. Returns the font probes too. */
function cloneFrame(source: PlaybackGIFSource, options: PlaybackGIFOptions | undefined) {
  const live = source.svg;
  const frame = live.ownerDocument.importNode(live, true);
  prepareSettledExportTheme(live, frame, options?.theme);
  const family =
    frame.style.getPropertyValue('--oc-font-family').trim() || options?.theme?.fonts.family;
  if (family) frame.style.fontFamily = family;
  const { css, fonts } = snapshotStyles(live, source.styleSelectors, frame.style.fontFamily);
  const themeBlock = frame.querySelector('style[data-oc-theme]');
  if (themeBlock) {
    themeBlock.append(`\n${css}`);
  } else if (css) {
    const style = frame.ownerDocument.createElementNS(SVG_NS, 'style');
    style.textContent = css;
    frame.prepend(style);
  }
  return { frame, fonts };
}

/** The explicit background, else the frame's opaque surface token, else the theme surface. */
function resolveBackground(
  frame: SVGSVGElement,
  options: PlaybackGIFOptions | undefined,
): string | undefined {
  if (options?.backgroundColor) return options.backgroundColor;
  const surface = frame.style.getPropertyValue('--oc-bg').trim();
  if (surface && !/^(none|transparent|currentcolor|url\()/i.test(surface)) return surface;
  return options?.theme?.colors.neutral.surface;
}

/** Embed the fonts the probes and the frame use, without leaving the probes in the frame. */
async function embedFrameFonts(frame: SVGSVGElement, fonts: SVGTextElement[]): Promise<void> {
  // Font discovery reads inline declarations. Supply the live CSS font usage
  // during discovery without changing the exported mark attributes.
  frame.append(...fonts);
  try {
    await embedFonts(frame);
  } finally {
    for (const font of fonts) font.remove();
  }
}

/** Settle on the abort signal's reason as soon as it fires, whatever the encoding is doing. */
async function abortable(encoding: Promise<Blob>, signal: AbortSignal | undefined): Promise<Blob> {
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

/**
 * Render the run from the first period through the end hold as a GIF. Frames sample
 * `durationMs` at `fps`; the settled final frame carries `holdEndMs`. A given theme is
 * inlined as a style block.
 * @throws {RangeError} If fps is not finite and positive, or the duration exceeds GIF limits.
 * @throws {Error} If gifenc is missing or fails to load, or the SVG has zero dimensions.
 * @throws The signal's reason when the export is aborted.
 */
export async function exportPlaybackGIF(
  source: PlaybackGIFSource,
  options?: PlaybackGIFOptions,
): Promise<Blob> {
  const { signal, durationMs, holdEndMs } = source;
  signal?.throwIfAborted();
  const { count, durationCs } = planFrames(durationMs, options?.fps ?? DEFAULT_FPS);
  const end = source.periodCount - 1;
  // Snapshot the live SVG and theme before yielding to the optional encoder import.
  const { frame, fonts } = cloneFrame(source, options);
  const backgroundColor = resolveBackground(frame, options);
  const encoderOptions = {
    dpi: options?.dpi,
    loop: options?.loop,
    backgroundColor,
    theme: options?.theme,
  };

  const encoding = encodeSVGFrames(
    frame,
    encoderOptions,
    async () => {
      source.draw(end, frame);
      if (options?.embedFonts !== false) await embedFrameFonts(frame, fonts);
      return {
        svg: frame,
        count,
        globalPalette: { swatches: paletteSwatches(frame, source.paletteSeed) },
        draw(index) {
          if (index === null) {
            source.draw(end, frame);
            return holdEndMs;
          }
          // Sample at the displayed start time, including the rounding to centiseconds.
          const before = Math.round((index / count) * durationCs);
          const after = Math.round(((index + 1) / count) * durationCs);
          source.draw((before / durationCs) * end, frame);
          return (after - before) * 10;
        },
      };
    },
    signal,
  );
  return abortable(encoding, signal);
}
