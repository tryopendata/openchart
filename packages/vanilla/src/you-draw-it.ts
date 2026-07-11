/**
 * "You draw it" interaction layer: the DOM/SVG overlay for the `youDrawIt`
 * spec option (NYT-style draw-then-reveal engagement format).
 *
 * SVG-space elements (hatched drawing region, reader's guess path, reveal
 * clip rect, pointer-capture overlay) render inside the chart's own SVG so
 * they clip and scale with it, following the crosshair/voronoi precedent
 * (`interactions/crosshair.ts`). The prompt text and skip-to-reveal button
 * are a small HTML overlay positioned over the drawing region, following the
 * series-search precedent (`series-search.ts`) — native `<button>` gets
 * keyboard semantics for free instead of hand-rolling SVG focus handling.
 *
 * State (the reader's in-progress guess) lives in this module's closure,
 * matching mount.ts's per-instance-closure convention (StrictMode double-
 * mount safe): a fresh `createYouDrawIt()` call gets a fresh closure.
 */

import type { Point, ResolvedYouDrawIt } from '@opendata-ai/openchart-core';
import { createSVGElement, setAttrs, SVG_NS } from './renderers/svg-dom';
import { nextSvgId } from './svg-ids';

export interface YouDrawItOptions {
  /** The chart container (`.oc-root`). Must be position: relative. */
  container: HTMLElement;
  /** Fired once the drawing is revealed, with the guess in data coordinates ordered by x. */
  onReveal?: (guess: Array<{ x: string | number; y: number }>) => void;
}

export interface YouDrawItController {
  /** Reposition, resync geometry, and (re)wire pointer capture against a freshly rendered layout + SVG. */
  update(config: ResolvedYouDrawIt, svg: SVGSVGElement, xSampleValues: Map<number, string | number>): void;
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

const SVG_URI = SVG_NS;

/** Minimum touch target size (effective hit area), per WCAG 2.5.5 / mobile a11y conventions. */
const MIN_TOUCH_TARGET = 24;

function getScale(svg: SVGSVGElement): { scaleX: number; scaleY: number } {
  const viewBox = svg.viewBox?.baseVal;
  const svgRect = svg.getBoundingClientRect();
  return {
    scaleX: viewBox?.width && svgRect.width ? svgRect.width / viewBox.width : 1,
    scaleY: viewBox?.height && svgRect.height ? svgRect.height / viewBox.height : 1,
  };
}

/** Build the "M x,y L x,y ..." path string for a straight-segment line through points, sorted by x. */
function buildLinearPath(points: Point[]): string {
  if (points.length === 0) return '';
  const sorted = [...points].sort((a, b) => a.x - b.x);
  return sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
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
  /** Reader's guess: pixel y keyed by pixel x sample. */
  const guessByX = new Map<number, number>();
  /** Data-coordinate x values keyed by pixel x sample, for onReveal/getGuess. */
  let sampleValueByX: Map<number, string | number> = new Map();
  let cleanupPointerEvents: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // SVG elements (rebuilt each update() since the SVG itself is rebuilt on render)
  // ---------------------------------------------------------------------------

  function buildHatchPattern(id: string, color: string): SVGElement {
    const pattern = document.createElementNS(SVG_URI, 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '8');
    pattern.setAttribute('height', '8');
    pattern.setAttribute('patternTransform', 'rotate(45)');
    const line = document.createElementNS(SVG_URI, 'line');
    setAttrs(line, { x1: 0, y1: 0, x2: 0, y2: 8, stroke: color, 'stroke-width': 2 });
    pattern.appendChild(line);
    return pattern;
  }

  function render(cfg: ResolvedYouDrawIt, svg: SVGSVGElement): void {
    // Remove any previous you-draw-it group (SVG is rebuilt each render, but
    // defensive against re-entrant calls).
    svg.querySelector('[data-you-draw-it]')?.remove();

    const group = createSVGElement('g') as SVGGElement;
    group.setAttribute('data-you-draw-it', 'true');
    group.setAttribute('class', 'oc-you-draw-it');

    const { area, fromX } = cfg;
    const regionWidth = Math.max(0, area.x + area.width - fromX);

    // Hatch pattern def
    const defs = createSVGElement('defs');
    const patternId = nextSvgId('oc-ydi-hatch');
    defs.appendChild(buildHatchPattern(patternId, cfg.lineColor));
    group.appendChild(defs);

    // Hatched "draw here" region
    const region = createSVGElement('rect');
    setAttrs(region, {
      x: fromX,
      y: area.y,
      width: regionWidth,
      height: area.height,
      fill: `url(#${patternId})`,
      'fill-opacity': revealed ? 0 : 0.12,
    });
    region.setAttribute('class', 'oc-ydi-region');
    region.setAttribute('data-ydi-region', 'true');
    region.setAttribute('pointer-events', 'none');
    group.appendChild(region);

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

    const targetLineEl = svg.querySelector<SVGPathElement>(
      `[data-mark-key="${cfg.targetKey}"] path, path[data-mark-key="${cfg.targetKey}"]`,
    );
    if (targetLineEl) {
      targetLineEl.setAttribute('clip-path', `url(#${clipId})`);
    }

    // Optional comparison line (host-supplied "everyone else's guess")
    if (cfg.comparisonPoints && cfg.comparisonPoints.length > 0) {
      const compPath = createSVGElement('path');
      setAttrs(compPath, { d: buildLinearPath(cfg.comparisonPoints), fill: 'none' });
      compPath.setAttribute('class', 'oc-ydi-comparison');
      group.appendChild(compPath);
    }

    // Reader's guess path (pen style), populated as the reader draws
    const guessPath = createSVGElement('path');
    setAttrs(guessPath, { d: '', fill: 'none' });
    guessPath.setAttribute('class', 'oc-ydi-guess');
    guessPath.setAttribute('data-ydi-guess-path', 'true');
    group.appendChild(guessPath);

    // Pointer-capture overlay over the drawing region only
    const overlay = createSVGElement('rect');
    setAttrs(overlay, {
      x: fromX,
      y: area.y,
      width: regionWidth,
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
    if (!revealed) {
      group.appendChild(overlay);
    }

    svg.appendChild(group);
  }

  function redrawGuessPath(): void {
    if (!svgEl) return;
    const path = svgEl.querySelector<SVGPathElement>('[data-ydi-guess-path]');
    if (!path) return;
    const points: Point[] = Array.from(guessByX.entries()).map(([x, y]) => ({ x, y }));
    path.setAttribute('d', buildLinearPath(points));
  }

  function snapToNearestSample(px: number): number | null {
    if (!config || config.sampleXs.length === 0) return null;
    let nearest = config.sampleXs[0];
    let best = Math.abs(nearest - px);
    for (const x of config.sampleXs) {
      const d = Math.abs(x - px);
      if (d < best) {
        best = d;
        nearest = x;
      }
    }
    return nearest;
  }

  function clampY(py: number): number {
    if (!config) return py;
    return Math.min(config.area.y + config.area.height, Math.max(config.area.y, py));
  }

  // ---------------------------------------------------------------------------
  // Pointer capture (mouse + touch), following the crosshair toSvgCoords pattern
  // ---------------------------------------------------------------------------

  function wirePointerEvents(svg: SVGSVGElement): () => void {
    const overlay = svg.querySelector('[data-ydi-overlay]');
    if (!overlay) return () => {};

    let dragging = false;

    const toSvgCoords = (clientX: number, clientY: number) => {
      const svgRect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox?.baseVal;
      const scaleX = viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1;
      const scaleY = viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1;
      return {
        svgX: (clientX - svgRect.left) * scaleX,
        svgY: (clientY - svgRect.top) * scaleY,
      };
    };

    const paintAt = (clientX: number, clientY: number) => {
      const { svgX, svgY } = toSvgCoords(clientX, clientY);
      const snapped = snapToNearestSample(svgX);
      if (snapped === null) return;
      guessByX.set(snapped, clampY(svgY));
      redrawGuessPath();
    };

    const handleMouseDown = (e: Event) => {
      const me = e as MouseEvent;
      dragging = true;
      paintAt(me.clientX, me.clientY);
    };
    const handleMouseMove = (e: Event) => {
      if (!dragging) return;
      const me = e as MouseEvent;
      paintAt(me.clientX, me.clientY);
    };
    const handleMouseUp = () => {
      dragging = false;
    };

    const handleTouchStart = (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length === 0) return;
      if (te.cancelable) te.preventDefault();
      dragging = true;
      paintAt(te.touches[0].clientX, te.touches[0].clientY);
    };
    const handleTouchMove = (e: Event) => {
      if (!dragging) return;
      const te = e as TouchEvent;
      if (te.touches.length === 0) return;
      if (te.cancelable) te.preventDefault();
      paintAt(te.touches[0].clientX, te.touches[0].clientY);
    };
    const handleTouchEnd = () => {
      dragging = false;
    };

    overlay.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    overlay.addEventListener('touchend', handleTouchEnd);
    overlay.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      overlay.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      overlay.removeEventListener('touchstart', handleTouchStart);
      overlay.removeEventListener('touchmove', handleTouchMove);
      overlay.removeEventListener('touchend', handleTouchEnd);
      overlay.removeEventListener('touchcancel', handleTouchEnd);
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

  const revealButton = document.createElement('button');
  revealButton.type = 'button';
  revealButton.className = 'oc-ydi-reveal-button';

  root.append(prompt, revealButton);
  container.style.position = container.style.position || 'relative';
  container.appendChild(root);

  function reduceMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
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
        // Force layout so the transition on the width change is observed,
        // matching the scoped-CSS-transition fallback noted in the plan
        // when the generic rAF transition driver isn't applicable (clip
        // rects aren't marks the update-transition driver tracks).
        void clipRect.getBoundingClientRect();
        clipRect.setAttribute('width', String(config.area.width));
      }
    }
    const region = svgEl.querySelector<SVGRectElement>('[data-ydi-region]');
    region?.setAttribute('fill-opacity', '0');
    svgEl.querySelector('[data-ydi-overlay]')?.remove();
    root.classList.add('oc-ydi-revealed');
    revealButton.disabled = true;

    onReveal?.(getGuessData());
  }

  function getGuessData(): Array<{ x: string | number; y: number }> {
    if (!config) return [];
    const area = config.area;
    const entries = Array.from(guessByX.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([px, py]) => {
        const value = sampleValueByX.get(px);
        // Convert pixel y back to a 0-1 fraction of the plot area, then
        // leave y in pixel space for callers without scale access; data-
        // coordinate y isn't reconstructible client-side without the y
        // scale, so this reports the pixel y normalized to the area (0 at
        // bottom, 1 at top) which callers can map through their own scale
        // if needed. Most consumers only need x identity + relative shape.
        const fraction = 1 - (py - area.y) / (area.height || 1);
        return { x: value ?? px, y: fraction };
      });
    return entries;
  }

  revealButton.addEventListener('click', doReveal);

  return {
    update(cfg: ResolvedYouDrawIt, svg: SVGSVGElement, xSampleValues: Map<number, string | number>): void {
      if (destroyed) return;
      cleanupPointerEvents?.();
      cleanupPointerEvents = null;

      config = cfg;
      svgEl = svg;
      sampleValueByX = xSampleValues;

      render(cfg, svg);
      redrawGuessPath();

      prompt.textContent = revealed ? '' : cfg.prompt;
      revealButton.textContent = cfg.revealLabel;
      revealButton.setAttribute('aria-label', cfg.revealLabel);
      revealButton.style.minHeight = `${MIN_TOUCH_TARGET}px`;
      revealButton.style.minWidth = `${MIN_TOUCH_TARGET}px`;

      const { scaleX, scaleY } = getScale(svg);
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const regionWidth = Math.max(0, cfg.area.x + cfg.area.width - cfg.fromX);
      root.style.left = `${cfg.fromX * scaleX + (svgRect.left - containerRect.left)}px`;
      root.style.top = `${cfg.area.y * scaleY + (svgRect.top - containerRect.top)}px`;
      root.style.width = `${regionWidth * scaleX}px`;
      root.style.display = 'flex';
      void scaleY;

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
      if (destroyed) return;
      revealed = false;
      guessByX.clear();
      revealButton.disabled = false;
      root.classList.remove('oc-ydi-revealed');
      if (config && svgEl) {
        render(config, svgEl);
        prompt.textContent = config.prompt;
        cleanupPointerEvents?.();
        cleanupPointerEvents = wirePointerEvents(svgEl);
      }
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
