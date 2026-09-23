/**
 * "You draw it" interaction layer: the DOM/SVG overlay for the `youDrawIt`
 * spec option (NYT-style draw-then-reveal engagement format).
 *
 * SVG-space elements (hatched drawing region, reader's guess path, reveal
 * clip rect, pointer-capture overlay) render inside the chart's own SVG so
 * they clip and scale with it. The prompt text and skip-to-reveal button are
 * a small HTML overlay positioned over the drawing region, following the
 * series-search precedent (`series-search.ts`): a native `<button>` gets
 * keyboard semantics for free instead of hand-rolling SVG focus handling.
 *
 * State (the reader's in-progress guess) lives in this module's closure,
 * matching mount.ts's per-instance-closure convention (StrictMode double-
 * mount safe): a fresh `createYouDrawIt()` call gets a fresh closure.
 *
 * The guess is a dense trail, not a set of snapped samples: one entry per
 * 1/TRAIL_RESOLUTION of the drawing region's width, holding a data-space y.
 * Storing it as (region fraction, data value) rather than pixels keeps the
 * drawing intact across resize re-renders. Per-sample values for `onReveal`
 * are interpolated from the trail on demand.
 */

import type { Point, ResolvedYouDrawIt } from '@opendata-ai/openchart-core';
import { applySrOnlyStyles } from './dom-helpers';
import { createSVGElement, SVG_NS, setAttrs } from './renderers/svg-dom';
import { nextSvgId } from './svg-ids';

export interface YouDrawItOptions {
  /** The chart container (`.oc-root`). Must be position: relative. */
  container: HTMLElement;
  /** Fired once the drawing is revealed, with the guess in data coordinates ordered by x. */
  onReveal?: (guess: Array<{ x: string | number; y: number }>) => void;
}

export interface YouDrawItController {
  /** Reposition, resync geometry, and (re)wire pointer capture against a freshly rendered layout + SVG. */
  update(config: ResolvedYouDrawIt, svg: SVGSVGElement): void;
  /** Hide (spec no longer wants youDrawIt on this render, e.g. mark type changed). */
  hide(): void;
  /** Reveal the real line and fire onReveal, without requiring reader interaction (skip-to-reveal). */
  reveal(): void;
  /** Clear the reader's guess and return to the drawing state. */
  reset(): void;
  /** Whether the drawing has been revealed. */
  readonly isRevealed: boolean;
  /** Remove all DOM elements. */
  destroy(): void;
}

/** Minimum touch target size (effective hit area), per WCAG 2.5.5 / mobile a11y conventions. */
const MIN_TOUCH_TARGET = 24;

/** Trail entries across the drawing region's width (~1px each at typical sizes). */
const TRAIL_RESOLUTION = 1000;

/** How far left of `from` the pointer overlay extends, so a press aimed at the visible line end still lands. */
const START_SLOP_PX = 16;

/** Minimum distance from `from` within which a first press starts the guess at the visible line end. */
const ANCHOR_SNAP_MIN_PX = 40;

/** Build the "M x,y L x,y ..." path string for a straight-segment line through points, sorted by x. */
function buildLinearPath(points: Point[]): string {
  if (points.length === 0) return '';
  const sorted = [...points].sort((a, b) => a.x - b.x);
  return sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

/** Round to two decimals for compact path strings. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Create the you-draw-it control. Mounted once per chart instance and kept
 * across re-renders so the in-progress drawing survives; `update()` re-syncs
 * geometry and re-wires pointer capture after each render.
 */
export function createYouDrawIt(options: YouDrawItOptions): YouDrawItController {
  const { container, onReveal } = options;

  let destroyed = false;
  let revealed = false;
  let config: ResolvedYouDrawIt | null = null;
  let svgEl: SVGSVGElement | null = null;
  /** Reader's guess: data-space y keyed by trail index (0..TRAIL_RESOLUTION across the drawing region). */
  const trail = new Map<number, number>();
  let cleanupPointerEvents: (() => void) | null = null;
  /**
   * The pointer drawing the current stroke. Lives outside wirePointerEvents so
   * a stroke survives a re-render mid-drag (resize, theme flip): the new
   * overlay re-captures the pointer and the stroke carries on.
   */
  let activePointer: number | null = null;

  // ---------------------------------------------------------------------------
  // SVG elements (rebuilt each update() since the SVG itself is rebuilt on render)
  // ---------------------------------------------------------------------------

  function buildHatchPattern(id: string, color: string): SVGElement {
    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '8');
    pattern.setAttribute('height', '8');
    pattern.setAttribute('patternTransform', 'rotate(45)');
    const line = document.createElementNS(SVG_NS, 'line');
    setAttrs(line, { x1: 0, y1: 0, x2: 0, y2: 8, stroke: color, 'stroke-width': 1 });
    line.setAttribute('stroke-opacity', '0.5');
    pattern.appendChild(line);
    return pattern;
  }

  /** Locate the target line's <path> in the freshly rendered SVG. */
  function findTargetLinePath(svg: SVGSVGElement, seriesKey?: string): SVGPathElement | null {
    // Line marks render as <g data-mark-id="line-{seriesKey ?? index}"> with a
    // single <path> child (see renderers/marks.ts). Prefer the seriesKey match;
    // fall back to the first line mark for single-series charts (no color enc).
    if (seriesKey) {
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(seriesKey)
          : seriesKey.replace(/"/g, '\\"');
      const byKey = svg.querySelector<SVGPathElement>(`[data-mark-id="line-${escaped}"] path`);
      if (byKey) return byKey;
    }
    return svg.querySelector<SVGPathElement>('.oc-mark-line path');
  }

  function render(cfg: ResolvedYouDrawIt, svg: SVGSVGElement): void {
    // Remove any previous you-draw-it group (SVG is rebuilt each render, but
    // defensive against re-entrant calls).
    svg.querySelector('[data-you-draw-it]')?.remove();

    const group = createSVGElement('g') as SVGGElement;
    group.setAttribute('data-you-draw-it', 'true');
    group.setAttribute('class', 'oc-ydi');

    const { area, fromX } = cfg;
    const regionWidth = Math.max(0, area.x + area.width - fromX);

    // Hatch pattern + reveal clip defs.
    const defs = createSVGElement('defs');
    const patternId = nextSvgId('oc-ydi-hatch');
    defs.appendChild(buildHatchPattern(patternId, cfg.lineColor));

    // Reveal clip: masks the real line's post-from segment until reveal.
    // Applied to the target line path element itself (not a <g>), matching
    // the SVG clip-path gotcha in .claude/rules/svg-animation.md.
    const clipId = nextSvgId('oc-ydi-clip');
    const clipPath = createSVGElement('clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = createSVGElement('rect');
    setAttrs(clipRect, {
      x: area.x,
      y: area.y,
      width: revealed ? area.width : Math.max(0, fromX - area.x),
      height: area.height,
    });
    clipRect.setAttribute('data-ydi-clip-rect', 'true');
    clipRect.setAttribute('class', 'oc-ydi-clip-rect');
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    group.appendChild(defs);

    // Hatched "draw here" region.
    const region = createSVGElement('rect');
    setAttrs(region, {
      x: fromX,
      y: area.y,
      width: regionWidth,
      height: area.height,
      fill: `url(#${patternId})`,
    });
    region.setAttribute('class', 'oc-ydi-region');
    region.setAttribute('data-ydi-region', 'true');
    region.setAttribute('pointer-events', 'none');
    if (revealed) region.setAttribute('data-ydi-hidden', 'true');
    group.appendChild(region);

    // "from" boundary marker: a thin dashed rule where drawing begins.
    const boundary = createSVGElement('line');
    setAttrs(boundary, { x1: fromX, y1: area.y, x2: fromX, y2: area.y + area.height });
    boundary.setAttribute('class', 'oc-ydi-boundary');
    boundary.setAttribute('pointer-events', 'none');
    group.appendChild(boundary);

    const targetLineEl = findTargetLinePath(svg, cfg.targetSeriesKey);
    if (targetLineEl) {
      targetLineEl.setAttribute('clip-path', `url(#${clipId})`);
    }

    // Optional comparison line (host-supplied "everyone else's guess").
    if (cfg.comparisonPoints && cfg.comparisonPoints.length > 0) {
      const compPath = createSVGElement('path');
      setAttrs(compPath, { d: buildLinearPath(cfg.comparisonPoints), fill: 'none' });
      compPath.setAttribute('class', 'oc-ydi-comparison');
      compPath.setAttribute('pointer-events', 'none');
      group.appendChild(compPath);
    }

    // Reader's guess path (pen style), populated as the reader draws.
    const guessPath = createSVGElement('path');
    setAttrs(guessPath, { d: '', fill: 'none' });
    guessPath.setAttribute('class', 'oc-ydi-guess');
    guessPath.setAttribute('data-ydi-guess-path', 'true');
    guessPath.setAttribute('pointer-events', 'none');
    group.appendChild(guessPath);

    // Pointer-capture overlay over the drawing region, padded a little left of
    // `from` so a press aimed at the visible line end still starts a stroke.
    if (!revealed) {
      const overlayX = Math.max(area.x, fromX - START_SLOP_PX);
      const overlay = createSVGElement('rect');
      setAttrs(overlay, {
        x: overlayX,
        y: area.y,
        width: regionWidth + (fromX - overlayX),
        height: area.height,
        fill: 'transparent',
      });
      overlay.setAttribute('class', 'oc-ydi-overlay');
      overlay.setAttribute('data-ydi-overlay', 'true');
      overlay.setAttribute('role', 'img');
      overlay.setAttribute(
        'aria-label',
        'Drawing area: drag to sketch your guess of the trend, or use the reveal button to skip.',
      );
      overlay.style.touchAction = 'none';
      overlay.style.cursor = 'crosshair';
      group.appendChild(overlay);
    }

    svg.appendChild(group);
  }

  function regionWidthOf(cfg: ResolvedYouDrawIt): number {
    return Math.max(0, cfg.area.x + cfg.area.width - cfg.fromX);
  }

  /** Pixel x → fractional trail index (unrounded). */
  function pxToIndex(cfg: ResolvedYouDrawIt, px: number): number {
    const w = regionWidthOf(cfg);
    if (w === 0) return 0;
    return ((px - cfg.fromX) / w) * TRAIL_RESOLUTION;
  }

  function indexToPx(cfg: ResolvedYouDrawIt, index: number): number {
    return cfg.fromX + (index / TRAIL_RESOLUTION) * regionWidthOf(cfg);
  }

  function redrawGuessPath(): void {
    if (!svgEl || !config) return;
    const path = svgEl.querySelector<SVGPathElement>('[data-ydi-guess-path]');
    if (!path) return;
    const cfg = config;
    const points: Point[] = Array.from(trail.entries()).map(([i, v]) => ({
      x: round2(indexToPx(cfg, i)),
      y: round2(dataToPixelY(v)),
    }));
    path.setAttribute('d', buildLinearPath(points));
    syncResetButton();
  }

  function clampX(px: number): number {
    if (!config) return px;
    return Math.min(config.area.x + config.area.width, Math.max(config.fromX, px));
  }

  function clampY(py: number): number {
    if (!config) return py;
    return Math.min(config.area.y + config.area.height, Math.max(config.area.y, py));
  }

  /**
   * Write the trail across the pixel segment (x0,y0)→(x1,y1), one entry per
   * trail index it crosses, with y interpolated along the segment. Filling
   * every index in between means a fast sweep (sparse pointer events) still
   * leaves a continuous guess, and a backward sweep overwrites what it crosses.
   */
  function paintSegment(x0: number, y0: number, x1: number, y1: number): void {
    if (!config) return;
    const i0 = pxToIndex(config, x0);
    const i1 = pxToIndex(config, x1);
    const lo = Math.max(0, Math.ceil(Math.min(i0, i1)));
    const hi = Math.min(TRAIL_RESOLUTION, Math.floor(Math.max(i0, i1)));
    const span = i1 - i0;
    for (let i = lo; i <= hi; i++) {
      const t = span === 0 ? 1 : (i - i0) / span;
      trail.set(i, pixelYToData(y0 + t * (y1 - y0)));
    }
    // Always record the endpoint itself so a single tap leaves a mark.
    const end = Math.min(TRAIL_RESOLUTION, Math.max(0, Math.round(i1)));
    trail.set(end, pixelYToData(y1));
  }

  // ---------------------------------------------------------------------------
  // Pointer capture (mouse + touch), following the crosshair toSvgCoords pattern
  // ---------------------------------------------------------------------------

  function wirePointerEvents(svg: SVGSVGElement): () => void {
    const overlay = svg.querySelector<SVGRectElement>('[data-ydi-overlay]');
    if (!overlay) return () => {};

    // Pixel position of the previous pointer event in this render. Reset on
    // re-render, since pixel geometry may have changed; the next move then
    // resumes the stroke from where the pointer is.
    let last: Point | null = null;
    if (activePointer !== null) {
      try {
        overlay.setPointerCapture?.(activePointer);
      } catch {
        // The pointer lifted during the re-render; the stroke is over.
        activePointer = null;
      }
    }

    const toSvgPoint = (clientX: number, clientY: number): Point => {
      const svgRect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox?.baseVal;
      const scaleX = viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1;
      const scaleY = viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1;
      return {
        x: clampX((clientX - svgRect.left) * scaleX),
        y: clampY((clientY - svgRect.top) * scaleY),
      };
    };

    /**
     * Whether a stroke's first point is close enough to `from` to start the
     * guess at the visible line end. A press far to the right starts where it
     * lands instead, so we never invent a ramp the reader didn't draw.
     */
    const nearAnchor = (p: Point): boolean => {
      if (!config?.anchor) return false;
      const firstGap = config.samples.length > 0 ? config.samples[0].px - config.fromX : 0;
      return p.x - config.fromX <= Math.max(ANCHOR_SNAP_MIN_PX, firstGap * 1.5);
    };

    const handleDown = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.cancelable) pe.preventDefault();
      activePointer = pe.pointerId;
      overlay.setPointerCapture?.(pe.pointerId);
      const p = toSvgPoint(pe.clientX, pe.clientY);
      const anchor = config?.anchor;
      if (trail.size === 0 && anchor && nearAnchor(p)) {
        paintSegment(anchor.x, anchor.y, p.x, p.y);
      } else {
        paintSegment(p.x, p.y, p.x, p.y);
      }
      last = p;
      redrawGuessPath();
    };

    const handleMove = (e: Event) => {
      const pe = e as PointerEvent;
      if (activePointer !== pe.pointerId) return;
      if (pe.cancelable) pe.preventDefault();
      // Coalesced events carry the full-rate pointer path between frames.
      const coalesced = pe.getCoalescedEvents?.() ?? [];
      const events = coalesced.length > 0 ? coalesced : [pe];
      for (const ev of events) {
        const p = toSvgPoint(ev.clientX, ev.clientY);
        const from = last ?? p;
        paintSegment(from.x, from.y, p.x, p.y);
        last = p;
      }
      redrawGuessPath();
    };

    const handleUp = (e: Event) => {
      const pe = e as PointerEvent;
      if (activePointer !== pe.pointerId) return;
      activePointer = null;
      last = null;
    };

    overlay.addEventListener('pointerdown', handleDown);
    overlay.addEventListener('pointermove', handleMove);
    overlay.addEventListener('pointerup', handleUp);
    overlay.addEventListener('pointercancel', handleUp);

    return () => {
      overlay.removeEventListener('pointerdown', handleDown);
      overlay.removeEventListener('pointermove', handleMove);
      overlay.removeEventListener('pointerup', handleUp);
      overlay.removeEventListener('pointercancel', handleUp);
    };
  }

  // ---------------------------------------------------------------------------
  // Prompt + reveal button (HTML overlay, positioned over the drawing region)
  // ---------------------------------------------------------------------------

  const root = document.createElement('div');
  root.className = 'oc-ydi-controls';
  root.style.display = 'none';
  root.style.position = 'absolute';

  const prompt = document.createElement('div');
  prompt.className = 'oc-ydi-prompt';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'oc-ydi-reset-button';
  resetButton.hidden = true;

  const revealButton = document.createElement('button');
  revealButton.type = 'button';
  revealButton.className = 'oc-ydi-reveal-button';

  const actions = document.createElement('div');
  actions.className = 'oc-ydi-actions';
  actions.append(resetButton, revealButton);

  // Polite live region: the clear button hides itself on click, so this is
  // the only confirmation a screen-reader user gets that it worked.
  const live = document.createElement('span');
  live.className = 'oc-sr-only';
  applySrOnlyStyles(live);
  live.setAttribute('aria-live', 'polite');

  root.append(prompt, actions, live);
  container.style.position = container.style.position || 'relative';
  container.appendChild(root);

  function reduceMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * Map a drawn pixel y back to a data value via the linear yInvert anchors.
   *
   * This interpolates linearly in pixel space between the top and bottom
   * anchors. For a linear y-scale that is exact. For a log or pow scale it is
   * an approximation: the true inverse is curved, so a guess drawn halfway up
   * the plot reads back as the arithmetic midpoint of the domain rather than
   * the geometric (log) or power midpoint. The you-draw-it guess is a rough
   * "where did the reader think the line went" signal, not a precise readout,
   * so the linear approximation is acceptable here; revisit if a non-linear
   * scale ever needs an exact guess value.
   */
  function pixelYToData(py: number): number {
    if (!config) return py;
    const inv = config.yInvert;
    if (!inv) {
      // No invertible scale: report the pixel y normalized to the area (1 at
      // top, 0 at bottom) so callers still get relative shape.
      const area = config.area;
      return 1 - (py - area.y) / (area.height || 1);
    }
    const span = inv.bottomPixel - inv.topPixel;
    if (span === 0) return inv.topData;
    const t = (py - inv.topPixel) / span;
    return inv.topData + t * (inv.bottomData - inv.topData);
  }

  /** Inverse of `pixelYToData`, against the current config (so it tracks resizes). */
  function dataToPixelY(value: number): number {
    if (!config) return value;
    const inv = config.yInvert;
    if (!inv) {
      const area = config.area;
      return area.y + (1 - value) * area.height;
    }
    const dataSpan = inv.bottomData - inv.topData;
    if (dataSpan === 0) return inv.topPixel;
    const t = (value - inv.topData) / dataSpan;
    return inv.topPixel + t * (inv.bottomPixel - inv.topPixel);
  }

  /**
   * The guess at each x sample, interpolated from the trail. Samples outside
   * the drawn span are omitted, so an undrawn stretch is never reported.
   */
  function getGuessData(): Array<{ x: string | number; y: number }> {
    if (!config || trail.size === 0) return [];
    const cfg = config;
    const keys = Array.from(trail.keys()).sort((a, b) => a - b);
    const first = keys[0];
    const lastKey = keys[keys.length - 1];
    const out: Array<{ x: string | number; y: number }> = [];
    for (const sample of cfg.samples) {
      const i = pxToIndex(cfg, sample.px);
      if (i < first - 0.5 || i > lastKey + 0.5) continue;
      // Find the trail entries bracketing i and interpolate between them.
      let hiPos = keys.findIndex((k) => k >= i);
      if (hiPos === -1) hiPos = keys.length - 1;
      const loPos = hiPos > 0 && keys[hiPos] > i ? hiPos - 1 : hiPos;
      const k0 = keys[loPos];
      const k1 = keys[hiPos];
      const v0 = trail.get(k0)!;
      const v1 = trail.get(k1)!;
      const t = k1 === k0 ? 0 : (i - k0) / (k1 - k0);
      out.push({ x: sample.xValue, y: v0 + t * (v1 - v0) });
    }
    return out;
  }

  /** The clear button shows only while there is a drawing to clear and before reveal. */
  function syncResetButton(): void {
    resetButton.hidden = revealed || trail.size === 0;
  }

  function doReveal(): void {
    if (destroyed || revealed || !svgEl || !config) return;
    revealed = true;

    const clipRect = svgEl.querySelector<SVGRectElement>('[data-ydi-clip-rect]');
    if (clipRect) {
      if (reduceMotion()) {
        clipRect.setAttribute('width', String(config.area.width));
      } else {
        clipRect.classList.add('oc-ydi-clip-animate');
        // Force layout so the transition on the width change is observed. The
        // update-transition rAF driver only tracks marks, so a scoped CSS
        // transition on the clip rect is the plan's accepted fallback.
        void clipRect.getBoundingClientRect();
        clipRect.setAttribute('width', String(config.area.width));
      }
    }
    const region = svgEl.querySelector<SVGRectElement>('[data-ydi-region]');
    region?.setAttribute('data-ydi-hidden', 'true');
    svgEl.querySelector('[data-ydi-overlay]')?.remove();
    cleanupPointerEvents?.();
    cleanupPointerEvents = null;
    root.classList.add('oc-ydi-revealed');
    prompt.textContent = '';
    revealButton.disabled = true;
    syncResetButton();

    onReveal?.(getGuessData());
  }

  function doReset(): void {
    if (destroyed) return;
    revealed = false;
    trail.clear();
    revealButton.disabled = false;
    root.classList.remove('oc-ydi-revealed');
    live.textContent = '';
    syncResetButton();
    if (config && svgEl) {
      render(config, svgEl);
      prompt.textContent = config.prompt;
      cleanupPointerEvents?.();
      cleanupPointerEvents = wirePointerEvents(svgEl);
    }
  }

  revealButton.addEventListener('click', doReveal);
  resetButton.addEventListener('click', () => {
    doReset();
    // The clear button just hid itself; keep keyboard focus on the controls.
    revealButton.focus();
    live.textContent = 'Drawing cleared';
  });

  return {
    update(cfg: ResolvedYouDrawIt, svg: SVGSVGElement): void {
      if (destroyed) return;
      cleanupPointerEvents?.();
      cleanupPointerEvents = null;

      config = cfg;
      svgEl = svg;

      render(cfg, svg);
      redrawGuessPath();

      prompt.textContent = revealed ? '' : cfg.prompt;
      revealButton.textContent = cfg.revealLabel;
      revealButton.setAttribute('aria-label', cfg.revealLabel);
      revealButton.style.minHeight = `${MIN_TOUCH_TARGET}px`;
      revealButton.disabled = revealed;
      resetButton.textContent = cfg.resetLabel;
      resetButton.setAttribute('aria-label', `${cfg.resetLabel} your drawing`);
      resetButton.style.minHeight = `${MIN_TOUCH_TARGET}px`;
      syncResetButton();
      if (revealed) root.classList.add('oc-ydi-revealed');
      else root.classList.remove('oc-ydi-revealed');

      // Position the HTML controls over the drawing region. Same viewBox-scale
      // approach as series-search / the text edit overlay.
      const viewBox = svg.viewBox?.baseVal;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scaleX = viewBox?.width && svgRect.width ? svgRect.width / viewBox.width : 1;
      const scaleY = viewBox?.height && svgRect.height ? svgRect.height / viewBox.height : 1;
      const regionWidth = Math.max(0, cfg.area.x + cfg.area.width - cfg.fromX);
      root.style.left = `${cfg.fromX * scaleX + (svgRect.left - containerRect.left)}px`;
      root.style.top = `${cfg.area.y * scaleY + (svgRect.top - containerRect.top)}px`;
      root.style.width = `${regionWidth * scaleX}px`;
      root.style.height = `${cfg.area.height * scaleY}px`;
      root.style.display = 'flex';

      if (!revealed) {
        cleanupPointerEvents = wirePointerEvents(svg);
      }
    },
    hide(): void {
      root.style.display = 'none';
      svgEl?.querySelector('[data-you-draw-it]')?.remove();
      cleanupPointerEvents?.();
      cleanupPointerEvents = null;
    },
    reveal(): void {
      doReveal();
    },
    reset(): void {
      activePointer = null;
      doReset();
    },
    get isRevealed(): boolean {
      return revealed;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cleanupPointerEvents?.();
      cleanupPointerEvents = null;
      root.remove();
    },
  };
}
