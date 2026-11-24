import {
  cssTokenDefault,
  estimateTextWidth,
  type RaceLayout,
  type RaceSpec,
  type RaceTableGeometry,
  truncateToWidth,
} from '@opendata-ai/openchart-core';
import { layoutRace, prepareRace, raceGeometryAt } from '@opendata-ai/openchart-engine';
import type { RenderContext } from '../render-context';
import { setAttrs } from '../renderers/svg-dom';
import type { StaticRenderOptions } from '../static-render';
import { buildThemeStyleBlock } from '../theme-style-block';
import { createRaceBarRenderer } from './render-bar';
import { createRaceLineRenderer } from './render-line';
import { controlsLift, renderRaceChrome } from './shell';
import { RACE_CONTROLS_HEIGHT } from './size';
import { setNumbers } from './svg-attrs';

function drawTable(
  host: SVGElement,
  layout: Extract<RaceLayout, { mark: 'table' }>,
  geometry: RaceTableGeometry,
  idScope: string,
  { factory }: RenderContext,
) {
  const { area, static: stat, theme } = layout;
  const {
    columns,
    labels,
    rowHeight,
    headerHeight,
    bodyHeight,
    fontSize,
    cellPadding: padding,
  } = stat;
  const bodyY = area.y + headerHeight;
  const chip = 8;
  const chipGap = 6;
  const radius = Number.parseFloat(cssTokenDefault('--oc-radius-sm', 'light'));
  const weight = theme.fonts.weights;
  const defs = factory.svg('defs');

  function clip(id: string, bounds: { x: number; y: number; width: number; height: number }) {
    const path = factory.svg('clipPath');
    path.setAttribute('id', id);
    const rect = factory.svg('rect');
    setNumbers(rect, bounds);
    path.append(rect);
    defs.append(path);
    return `url(#${id})`;
  }

  const head = factory.svg('g');
  const body = factory.svg('g');
  setAttrs(host, {
    'font-size': fontSize,
    'dominant-baseline': 'central',
    fill: 'var(--oc-text)',
  });
  setAttrs(head, { 'font-weight': weight.semibold, fill: 'var(--oc-text-muted)' });
  body.setAttribute(
    'clip-path',
    clip(`${idScope}-body`, { x: area.x, y: bodyY, width: area.width, height: bodyHeight }),
  );
  function rule(parent: SVGElement, y: number) {
    const line = factory.svg('line');
    setNumbers(line, { x1: area.x, x2: area.x + area.width, y1: y, y2: y });
    line.setAttribute('stroke', 'var(--oc-border)');
    parent.append(line);
  }

  function cellText(
    parent: SVGElement,
    column: (typeof columns)[number],
    y: number,
    text: string,
    fill?: string,
    chipInset = 0,
  ) {
    if (!text) return;
    const node = factory.svg('text');
    const right = column.column !== 'name' && column.column !== 'bar';
    setNumbers(node, {
      x: right ? column.x + column.width - padding : column.x + padding + chipInset,
      y,
    });
    if (right) node.setAttribute('text-anchor', 'end');
    if (fill) node.setAttribute('fill', fill);
    const fontWeight = parent === head ? weight.semibold : weight.normal;
    const budget = column.width - 2 * padding - chipInset;
    const measure = (value: string) =>
      layout.measureText?.(value, fontSize, fontWeight).width ??
      estimateTextWidth(value, fontSize, fontWeight);
    node.textContent =
      measure(text) <= budget
        ? text
        : measure('…') <= budget
          ? truncateToWidth(text, budget, fontSize, fontWeight, measure)
          : '';
    parent.append(node);
  }

  for (const column of columns) {
    cellText(head, column, area.y + headerHeight / 2, labels[column.column]);
  }
  if (headerHeight > 0) rule(head, bodyY - 0.5);
  for (let slot = 1; slot <= (rowHeight > 0 ? Math.round(bodyHeight / rowHeight) : 0); slot++) {
    rule(body, bodyY + slot * rowHeight - 0.5);
  }

  for (const row of geometry.rows) {
    const group = factory.svg('g');
    const paintHeight = Math.max(0, rowHeight - 1);
    const y = bodyY + row.y + row.contentOffset + paintHeight / 2;
    setAttrs(group, { 'data-key': row.key, opacity: row.opacity });
    row.cells.forEach((cell, index) => {
      const column = columns[index];
      if (cell.column === 'bar') {
        const bar = factory.svg('rect');
        const height = Math.min(8, paintHeight * 0.55);
        const corner = Math.min(radius, height / 2, column.width / 2);
        setNumbers(bar, {
          x: column.x + cell.x,
          y: y - height / 2,
          width: cell.width,
          height,
          rx: column.width > 0 ? (corner * cell.width) / column.width : 0,
          ry: corner,
        });
        bar.setAttribute('fill', cell.color);
        group.append(bar);
      } else if (cell.column === 'name') {
        const dot = factory.svg('circle');
        setNumbers(dot, { cx: column.x + padding + chip / 2, cy: y, r: chip / 2 });
        dot.setAttribute('fill', cell.color);
        group.append(dot);
        cellText(group, column, y, cell.text, undefined, chip + chipGap);
      } else {
        const ink =
          cell.column === 'share' ? 'muted' : cell.column === 'change' ? cell.direction : '';
        const fill =
          ink === 'up'
            ? 'var(--oc-positive)'
            : ink === 'down'
              ? 'var(--oc-negative)'
              : ink
                ? 'var(--oc-text-muted)'
                : undefined;
        cellText(group, column, y, cell.text, fill);
      }
    });
    body.append(group);
  }
  host.append(defs, head, body);
}

/** Render a race's final frame using the same layout and SVG marks as the player. */
export function renderRaceStaticParts(
  spec: RaceSpec,
  options: StaticRenderOptions,
  ctx: RenderContext,
) {
  const { factory } = ctx;
  const model = prepareRace(spec, { onWarn: () => {} });
  const width = options.width ?? model.spec.width ?? 640;
  const height = options.height ?? model.spec.height ?? 520;
  const controls = model.playback.controls ? RACE_CONTROLS_HEIGHT : 0;
  const layout = layoutRace(model, {
    width,
    height: Math.max(0, height - controls),
    darkMode: options.darkMode === 'force',
    theme: options.theme,
    watermark: options.watermark,
    measureText: options.measureText,
  });
  const t = model.timeline.periodCount - 1;
  const period = model.periodLabels[t];
  const geometry = raceGeometryAt(model, layout, t);
  const svg = factory.svg('svg');
  const id = ctx.ids.next('oc-root');
  setAttrs(svg, {
    class: 'oc-race',
    id,
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    'data-theme': layout.theme.isDark ? 'dark' : 'light',
    'font-family': layout.theme.fonts.family,
    'font-weight': layout.theme.fonts.weights.normal,
  });
  const defs = factory.svg('defs');
  const style = factory.svg('style');
  style.textContent = `${buildThemeStyleBlock(layout.theme, id)}
${[
  ['.oc-race-axis line', 'stroke: var(--oc-gridline)'],
  ['.oc-race-axis text, .oc-race-summary, .oc-race-line-value', 'fill: var(--oc-text-muted)'],
  ['.oc-race-summary', 'font-size: var(--oc-source-size)'],
  ['.oc-race-rows text', 'fill: var(--oc-text); font-size: var(--oc-body-size)'],
  ['.oc-race-period', 'fill: var(--oc-text-faint); font-weight: 600'],
  ['.oc-race-line-labels', 'dominant-baseline: central; font-size: var(--oc-body-size)'],
]
  .map(
    ([selectors, declarations]) =>
      `${selectors
        .split(', ')
        .map((selector) => `#${id.replaceAll('.', '\\.')} ${selector}`)
        .join(', ')} { ${declarations}; }`,
  )
  .join('\n')}`;
  defs.append(style);
  svg.append(defs);

  if (layout.a11y.hidden) svg.setAttribute('aria-hidden', 'true');
  else {
    const description = factory.svg('desc');
    const descriptionId = ctx.ids.next('rankings');
    description.setAttribute('id', descriptionId);
    description.textContent = [
      model.spec.a11y?.description,
      ...model.timeline
        .ranked(t)
        .slice(0, model.timeline.top)
        .map(
          (key, rank) =>
            `${rank + 1}. ${model.matrix.labels[key]}, ${model.formatValue(model.timeline.valueAt(key, t))}.`,
        ),
    ]
      .filter(Boolean)
      .join(' ');
    setAttrs(svg, {
      role: 'img',
      'aria-label': `${layout.chrome.title?.text || 'Race chart'} (${period})`,
      'aria-describedby': descriptionId,
    });
    svg.append(description);
  }

  renderRaceChrome(svg, layout, ctx);
  const host = factory.svg('g') as SVGGElement;
  host.setAttribute('class', 'oc-race-mark');
  const idScope = ctx.ids.next('race');
  if (layout.mark === 'bar' && geometry.mark === 'bar') {
    createRaceBarRenderer(host, layout.static, idScope, factory).draw(geometry);
  } else if (layout.mark === 'line' && geometry.mark === 'line') {
    createRaceLineRenderer(host, layout.static, idScope, factory).draw(geometry);
  } else if (layout.mark === 'table' && geometry.mark === 'table') {
    drawTable(host, layout, geometry, idScope, ctx);
  }
  svg.append(host);

  if (controls) {
    const readout = factory.svg('text');
    setAttrs(readout, {
      class: 'oc-race-static-readout',
      x: width - layout.theme.spacing.padding,
      y: layout.height - controlsLift(layout) + controls / 2,
      'text-anchor': 'end',
      'dominant-baseline': 'central',
      'font-size': layout.chrome.source?.style.fontSize ?? layout.theme.chrome.source.fontSize,
      fill: 'var(--oc-text-muted)',
    });
    readout.textContent = period;
    svg.append(readout);
  }
  return svg;
}
