import { type RaceLayout, type RaceMarkType, wrapText } from '@opendata-ai/openchart-core';
import { renderAttributionBrand } from '../renderers/brand';
import { renderChromeElement, renderChromeRuleAndEyebrow } from '../renderers/chrome';
import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import { stampThemeProperties } from '../theme-tokens';

export type RaceMarkHost<TMark extends RaceMarkType> = TMark extends 'table'
  ? HTMLElement
  : SVGGElement;

/** The mounted race frame and the insertion points for marks and controls. */
export interface RaceShell<TMark extends RaceMarkType = RaceMarkType> {
  root: HTMLElement;
  svg: SVGSVGElement;
  markHost: RaceMarkHost<TMark>;
  controlsSlot: HTMLElement;
  /** Removes only the shell's root. Safe to call repeatedly. */
  destroy(): void;
}

function renderRaceChrome(svg: SVGSVGElement, layout: RaceLayout): void {
  const { chrome, area, measureText } = layout;
  const chromeGroup = svg.ownerDocument.createElementNS(SVG_NS, 'g');
  chromeGroup.setAttribute('class', 'oc-chrome');
  renderChromeRuleAndEyebrow(chromeGroup, chrome, measureText);

  const bottom = chrome.bottomAnchorY ?? area.y + area.height;
  for (const key of ['title', 'subtitle', 'source', 'byline', 'footer'] as const) {
    const element = chrome[key];
    if (!element) continue;
    const isBottom = key === 'source' || key === 'byline' || key === 'footer';
    renderChromeElement(
      chromeGroup,
      isBottom ? { ...element, y: bottom + element.y } : element,
      `oc-${key}`,
      key,
      measureText,
    );
  }
  svg.append(chromeGroup);
  renderAttributionBrand(
    svg,
    layout.watermark ? chrome : { ...chrome, watermark: undefined },
    bottom,
    measureText,
  );
  if (layout.a11y.hidden) svg.querySelector('.oc-chrome-ref')?.setAttribute('tabindex', '-1');
}

/** Measure from the last footer item, including wrapped lines and stacked branding. */
function controlsLift(layout: RaceLayout): number {
  const { area, chrome, height, measureText, watermark } = layout;
  const bottom = chrome.bottomAnchorY ?? area.y + area.height;
  let contentBottom = bottom;
  for (const key of ['source', 'byline', 'footer', 'brand', 'watermark'] as const) {
    const element = chrome[key];
    if (!element || (key === 'watermark' && !watermark)) continue;
    const { fontSize, fontWeight, lineHeight = 1.3 } = element.style;
    const wrapped = wrapText(element.text, fontSize, fontWeight, element.maxWidth, measureText);
    const lines = Math.min(wrapped.length, element.maxLines ?? Infinity);
    if (lines > 0) {
      const lastLineBottom = bottom + element.y + fontSize * (1 + lineHeight * (lines - 1));
      contentBottom = Math.max(contentBottom, lastLineBottom);
    }
  }
  return Math.max(0, height - contentBottom - 8);
}

function createMarkHost(root: HTMLElement, svg: SVGSVGElement, layout: RaceLayout) {
  const doc = root.ownerDocument;
  let markHost: RaceMarkHost<RaceMarkType>;
  if (layout.mark === 'table') {
    const { x, y, width, height } = layout.area;
    const { normal, semibold } = layout.theme.fonts.weights;
    markHost = doc.createElement('div');
    markHost.className = 'oc-race-table';
    if (layout.a11y.hidden) markHost.setAttribute('aria-hidden', 'true');
    root.style.position = 'relative';
    markHost.style.position = 'absolute';
    markHost.style.left = `${x}px`;
    markHost.style.top = `${y}px`;
    markHost.style.width = `${width}px`;
    markHost.style.height = `${height}px`;
    markHost.style.setProperty('--oc-race-table-body-weight', String(normal));
    markHost.style.setProperty('--oc-race-table-heading-weight', String(semibold));
    root.append(markHost);
  } else {
    markHost = doc.createElementNS(SVG_NS, 'g');
    markHost.setAttribute('class', 'oc-race-mark');
    svg.append(markHost);
  }

  const controlsSlot = doc.createElement('div');
  controlsSlot.className = 'oc-race-controls-slot';
  root.append(controlsSlot);

  return { markHost, controlsSlot };
}

/**
 * Appends a root with the SVG first, the HTML table host when needed, and the
 * controls slot last. Bar and line hosts are inside the SVG.
 *
 * @param idScope - The scope accepted by mark renderers. The shell creates no IDs.
 */
export function createRaceShell<TLayout extends RaceLayout>(
  container: HTMLElement,
  layout: TLayout,
  idScope: string,
): RaceShell<TLayout['mark']>;
/** Selects the host namespace from the layout mark and mounts the assembled root. */
export function createRaceShell(
  container: HTMLElement,
  layout: RaceLayout,
  _idScope: string,
): RaceShell {
  const doc = container.ownerDocument;
  const { width, height, a11y, theme } = layout;
  const root = doc.createElement('div');
  root.className = 'oc-root oc-race-root';
  stampThemeProperties(root, theme);

  const svg = doc.createElementNS(SVG_NS, 'svg');
  setAttrs(svg, { class: 'oc-race', viewBox: `0 0 ${width} ${height}` });
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = `${height}px`;
  svg.style.fontFamily = 'var(--oc-font-family)';
  if (a11y.hidden) svg.setAttribute('aria-hidden', 'true');
  else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', a11y.altText.trim() ? a11y.altText : 'Race chart');
  }
  stampThemeProperties(svg, theme);
  root.append(svg);

  renderRaceChrome(svg, layout);
  const { markHost, controlsSlot } = createMarkHost(root, svg, layout);
  controlsSlot.style.setProperty('--oc-race-padding', `${theme.spacing.padding}px`);
  if (layout.chrome.source) {
    controlsSlot.style.setProperty('--oc-source-size', `${layout.chrome.source.style.fontSize}px`);
  }
  if (root.style.getPropertyValue('--oc-accent')) {
    controlsSlot.style.setProperty('--oc-race-progress-color', 'var(--oc-accent)');
  }
  if (layout.playback.controls) {
    controlsSlot.style.setProperty('--oc-race-controls-lift', `${controlsLift(layout)}px`);
  }
  container.append(root);

  return {
    root,
    svg,
    markHost,
    controlsSlot,
    destroy() {
      root.remove();
    },
  };
}
