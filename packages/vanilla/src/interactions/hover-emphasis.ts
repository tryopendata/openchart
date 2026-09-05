/**
 * Hover emphasis: the one dim-the-rest / outline language shared by mark
 * hover, legend hover and the crosshair.
 *
 * Two registers, picked from the layout:
 *
 * - Multi-series (more than one distinct `seriesKey` across the marks):
 *   hovering a mark or a legend entry raises that series and drops the rest to
 *   `--oc-hover-dim`.
 * - Single-series: dim-the-rest on a twelve-column chart is a wave of fades on
 *   every pointer move, so the hovered mark gets an outline instead and nothing
 *   else changes.
 *
 * Legend hover always uses the full dim (a deliberate gesture, not a sweep),
 * which is why `setSeries` dims regardless of register.
 *
 * Everything is applied as a CSS class, never inline style: the class beats the
 * renderer's `opacity` attributes and loses to the transition driver's per-frame
 * inline `style.opacity`, which is exactly the precedence a mid-transition hover
 * needs.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';

const MARKS_ACTIVE_CLASS = 'oc-hover-active';
const MARK_HOVER_CLASS = 'oc-mark--hover';
const MARK_DIM_CLASS = 'oc-mark--dim';
const LEGEND_HOVER_CLASS = 'oc-legend-entry--hover';
const LEGEND_DIM_CLASS = 'oc-legend-entry--dim';

export interface HoverEmphasis {
  /** Emphasize one series and dim the others. `null` clears. */
  setSeries(seriesKey: string | null): void;
  /** Emphasize one mark element. `null` clears. */
  setMark(el: Element | null): void;
  /** Drop all emphasis. */
  clear(): void;
  /** Clear and release DOM references. */
  destroy(): void;
  /** True when the chart has more than one series (dim register). */
  readonly multiSeries: boolean;
}

const NOOP: HoverEmphasis = {
  setSeries() {},
  setMark() {},
  clear() {},
  destroy() {},
  multiSeries: false,
};

/** Count distinct series across the layout's marks. */
function countMarkSeries(layout: ChartLayout): number {
  const seen = new Set<string>();
  for (const mark of layout.marks) {
    const key = 'seriesKey' in mark ? mark.seriesKey : undefined;
    if (key) seen.add(key);
  }
  return seen.size;
}

export function createHoverEmphasis(svg: SVGElement, layout: ChartLayout): HoverEmphasis {
  // Canvas mark mode paints points into a bitmap: there are no per-mark
  // elements to class, and the canvas layer owns its own hover treatment.
  if (layout.markRenderMode === 'canvas') return NOOP;

  const marksGroup = svg.querySelector('.oc-marks') as SVGElement | null;
  if (!marksGroup) return NOOP;

  const multiSeries = countMarkSeries(layout) > 1;

  let markEls: Element[] | null = null;
  let legendEls: Element[] | null = null;

  function marks(): Element[] {
    if (!markEls) markEls = Array.from(marksGroup!.querySelectorAll('.oc-mark'));
    return markEls;
  }

  function legendEntries(): Element[] {
    if (!legendEls) legendEls = Array.from(svg.querySelectorAll('[data-legend-label]'));
    return legendEls;
  }

  function clear(): void {
    marksGroup!.classList.remove(MARKS_ACTIVE_CLASS);
    for (const el of marks()) {
      el.classList.remove(MARK_HOVER_CLASS, MARK_DIM_CLASS);
    }
    for (const el of legendEntries()) {
      el.classList.remove(LEGEND_HOVER_CLASS, LEGEND_DIM_CLASS);
    }
  }

  function applyLegend(seriesKey: string): void {
    for (const el of legendEntries()) {
      // Hidden entries already carry opacity="0.3" as an attribute. A dim class
      // at 0.3 would leave them unchanged but a hover class would brighten
      // them, so skip both: a toggled-off series stays visibly off.
      if (el.getAttribute('data-legend-active') === 'false') continue;
      const match = el.getAttribute('data-legend-label') === seriesKey;
      el.classList.toggle(LEGEND_HOVER_CLASS, match);
      el.classList.toggle(LEGEND_DIM_CLASS, !match);
    }
  }

  function setSeries(seriesKey: string | null): void {
    if (seriesKey === null) {
      clear();
      return;
    }
    marksGroup!.classList.add(MARKS_ACTIVE_CLASS);
    for (const el of marks()) {
      const match = el.getAttribute('data-series') === seriesKey;
      el.classList.toggle(MARK_HOVER_CLASS, match);
      el.classList.toggle(MARK_DIM_CLASS, !match);
    }
    applyLegend(seriesKey);
  }

  function setMark(el: Element | null): void {
    if (!el) {
      clear();
      return;
    }
    const series = el.getAttribute('data-series');
    if (multiSeries && series) {
      setSeries(series);
      return;
    }
    // Single-series register: outline the hovered mark, dim nothing.
    marksGroup!.classList.add(MARKS_ACTIVE_CLASS);
    for (const mark of marks()) {
      mark.classList.toggle(MARK_HOVER_CLASS, mark === el);
      mark.classList.remove(MARK_DIM_CLASS);
    }
  }

  return {
    setSeries,
    setMark,
    clear,
    destroy() {
      clear();
      markEls = null;
      legendEls = null;
    },
    multiSeries,
  };
}

/**
 * Hover-link the endpoint-label column: hovering a series' label raises that
 * series in the chart, the same gesture the legend offers when a chart has one.
 * Returns a cleanup function.
 */
export function wireEndpointLabelHover(svg: SVGElement, emphasis: HoverEmphasis): () => void {
  const entries = svg.querySelectorAll('[data-endpoint-key]');
  const cleanups: Array<() => void> = [];

  for (const entry of entries) {
    const key = entry.getAttribute('data-endpoint-key');
    if (!key) continue;
    const handleEnter = () => emphasis.setSeries(key);
    const handleLeave = () => emphasis.clear();
    entry.addEventListener('mouseenter', handleEnter);
    entry.addEventListener('mouseleave', handleLeave);
    cleanups.push(() => {
      entry.removeEventListener('mouseenter', handleEnter);
      entry.removeEventListener('mouseleave', handleLeave);
    });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
