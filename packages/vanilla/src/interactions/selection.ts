import type {
  Annotation,
  ChartLayout,
  ChartSpec,
  ChromeKey,
  ElementRef,
  GraphSpec,
  LayerSpec,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { elementRef } from '@opendata-ai/openchart-core';

/**
 * Find a DOM element inside the SVG that matches the given ElementRef.
 */
export function findElementByRef(svg: SVGElement, ref: ElementRef): SVGElement | null {
  switch (ref.type) {
    case 'annotation': {
      if (ref.id) {
        const byId = svg.querySelector(`[data-annotation-id="${ref.id}"]`);
        if (byId) return byId as SVGElement;
      }
      return svg.querySelector(`[data-annotation-index="${ref.index}"]`) as SVGElement | null;
    }
    case 'chrome':
      return svg.querySelector(`[data-chrome-key="${ref.key}"]`) as SVGElement | null;
    case 'series-label':
      return svg.querySelector(`.oc-mark-label[data-series="${ref.series}"]`) as SVGElement | null;
    case 'legend':
      return svg.querySelector('.oc-legend') as SVGElement | null;
    case 'legend-entry':
      return svg.querySelector(`[data-legend-index="${ref.index}"]`) as SVGElement | null;
  }
}

/**
 * Build an ElementRef from a DOM element's data attributes.
 */
export function buildElementRef(
  element: Element,
  _specAnnotations: Annotation[],
): ElementRef | null {
  const annotationEl = element.closest('[data-annotation-index]');
  if (annotationEl) {
    const index = Number(annotationEl.getAttribute('data-annotation-index'));
    const id = annotationEl.getAttribute('data-annotation-id') ?? undefined;
    return elementRef.annotation(index, id);
  }

  const chromeEl = element.closest('[data-chrome-key]');
  if (chromeEl) {
    const key = chromeEl.getAttribute('data-chrome-key') as ChromeKey;
    if (key) return elementRef.chrome(key);
  }

  const seriesLabelEl = element.closest('.oc-mark-label[data-series]');
  if (seriesLabelEl) {
    const series = seriesLabelEl.getAttribute('data-series');
    if (series) return elementRef.seriesLabel(series);
  }

  const legendEntryEl = element.closest('[data-legend-index]');
  if (legendEntryEl) {
    const index = Number(legendEntryEl.getAttribute('data-legend-index'));
    const series = legendEntryEl.getAttribute('data-legend-label') ?? '';
    return elementRef.legendEntry(series, index);
  }

  const legendEl = element.closest('.oc-legend');
  if (legendEl) return elementRef.legend();

  return null;
}

/**
 * Get an ordered list of all editable ElementRefs from the current spec and layout.
 */
export function getEditableElements(
  spec: ChartSpec | LayerSpec | GraphSpec,
  layout: ChartLayout,
): ElementRef[] {
  const refs: ElementRef[] = [];

  const chromeKeys: ChromeKey[] = ['title', 'subtitle', 'source', 'byline', 'footer'];
  for (const key of chromeKeys) {
    if (layout.chrome[key]) {
      refs.push(elementRef.chrome(key));
    }
  }

  const annotations: Annotation[] =
    'annotations' in spec && Array.isArray(spec.annotations) ? spec.annotations : [];
  for (let i = 0; i < annotations.length; i++) {
    refs.push(elementRef.annotation(i, annotations[i].id));
  }

  const seriesLabels: string[] = [];
  for (const mark of layout.marks) {
    if (mark.type === 'line' && mark.label?.visible && mark.seriesKey) {
      seriesLabels.push(mark.seriesKey);
    }
  }
  seriesLabels.sort();
  for (const series of seriesLabels) {
    refs.push(elementRef.seriesLabel(series));
  }

  if ('entries' in layout.legend && layout.legend.entries.length > 0) {
    refs.push(elementRef.legend());
  }

  return refs;
}

/**
 * Check if an ElementRef points to a text-editable element.
 */
export function isTextEditable(ref: ElementRef, specAnnotations: Annotation[]): boolean {
  if (ref.type === 'chrome') return true;
  if (ref.type === 'annotation') {
    const annotation = specAnnotations[ref.index];
    return annotation?.type === 'text';
  }
  return false;
}

/**
 * Get the current text content for an element ref.
 */
export function getElementText(
  ref: ElementRef,
  spec: ChartSpec | LayerSpec | GraphSpec,
): string | null {
  if (ref.type === 'chrome') {
    const chromeConfig = 'chrome' in spec ? spec.chrome : undefined;
    if (!chromeConfig) return null;
    const entry = chromeConfig[ref.key];
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && entry !== null && 'text' in entry) {
      return (entry as { text: string }).text;
    }
    return null;
  }
  if (ref.type === 'annotation') {
    const annotations: Annotation[] =
      'annotations' in spec && Array.isArray(spec.annotations) ? spec.annotations : [];
    const annotation = annotations[ref.index];
    if (annotation?.type === 'text') return (annotation as TextAnnotation).text ?? null;
    if (annotation?.label) return annotation.label;
    return null;
  }
  return null;
}

/**
 * Compare two ElementRefs for equality.
 */
export function refsEqual(a: ElementRef | null, b: ElementRef | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'annotation': {
      const bAnno = b as typeof a;
      if (a.id && bAnno.id) return a.id === bAnno.id;
      return a.index === bAnno.index;
    }
    case 'chrome':
      return a.key === (b as typeof a).key;
    case 'series-label':
      return a.series === (b as typeof a).series;
    case 'legend':
      return true;
    case 'legend-entry': {
      const bEntry = b as typeof a;
      return a.index === bEntry.index && a.series === bEntry.series;
    }
  }
}

/**
 * Render a selection overlay rectangle around a target element.
 */
export function renderSelectionOverlay(
  svg: SVGElement,
  ref: ElementRef,
  layout: ChartLayout,
): SVGGElement | null {
  const target = findElementByRef(svg, ref);
  if (!target) return null;

  const bbox = (target as SVGGraphicsElement).getBBox();
  const padding = 4;

  const accentColor = layout.theme.colors.categorical?.[0] ?? '#4f46e5';

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'oc-selection-overlay');

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(bbox.x - padding));
  rect.setAttribute('y', String(bbox.y - padding));
  rect.setAttribute('width', String(bbox.width + padding * 2));
  rect.setAttribute('height', String(bbox.height + padding * 2));
  rect.setAttribute('rx', '3');
  rect.setAttribute('fill', 'transparent');
  rect.setAttribute('stroke', accentColor);
  rect.setAttribute('stroke-width', '1.5');
  rect.setAttribute('pointer-events', 'none');

  g.appendChild(rect);
  svg.appendChild(g);

  return g;
}

/**
 * Create a visually-hidden data table from the chart's a11y fallback data.
 */
export function createScreenReaderTable(
  layout: ChartLayout,
  container: HTMLElement,
): HTMLTableElement | null {
  const data = layout.a11y.dataTableFallback;
  if (!data || data.length === 0) return null;

  const table = document.createElement('table');
  table.className = 'oc-sr-only';
  table.style.position = 'absolute';
  table.style.width = '1px';
  table.style.height = '1px';
  table.style.padding = '0';
  table.style.margin = '-1px';
  table.style.overflow = 'hidden';
  table.style.clipPath = 'inset(50%)';
  table.style.whiteSpace = 'nowrap';
  table.style.borderWidth = '0';
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', `Data table: ${layout.a11y.altText}`);

  if (data.length > 0) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = data[0] as unknown[];
    for (const header of headers) {
      const th = document.createElement('th');
      th.textContent = String(header ?? '');
      th.setAttribute('scope', 'col');
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
  }

  if (data.length > 1) {
    const tbody = document.createElement('tbody');
    for (let i = 1; i < data.length; i++) {
      const tr = document.createElement('tr');
      const cells = data[i] as unknown[];
      for (const cell of cells) {
        const td = document.createElement('td');
        td.textContent = String(cell ?? '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  container.appendChild(table);
  return table;
}
