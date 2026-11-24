import type { RaceBarGeometry, RaceBarStatic } from '@opendata-ai/openchart-core';
import { createSVGElement, setAttrs } from '../renderers/svg-dom';
import { setNumbers } from './svg-attrs';

/** Draws in the host's user space and removes only its own nodes on `destroy()`. */
export interface RaceBarRenderer {
  draw(geometry: RaceBarGeometry): void;
  destroy(): void;
}

function drawText(element: SVGElement, label: { x: number; y: number; text: string } | null) {
  if (label) setNumbers(element, { x: label.x, y: label.y });
  if (element.textContent !== (label?.text ?? '')) element.textContent = label?.text ?? '';
}

/** Append a keyed SVG renderer to `host`. Use host coordinates for layout and geometry. */
export function createRaceBarRenderer(
  host: SVGGElement,
  stat: RaceBarStatic,
  idScope: string,
): RaceBarRenderer {
  const clipId = `${idScope}-race-clip`;
  const defs = createSVGElement('defs');
  const clipPath = createSVGElement('clipPath');
  clipPath.setAttribute('id', clipId);
  const clipRect = createSVGElement('rect');
  setNumbers(clipRect, stat.clip);
  clipPath.append(clipRect);
  defs.append(clipPath);

  const axis = createSVGElement('g');
  axis.setAttribute('class', 'oc-race-axis');
  const rows = createSVGElement('g');
  setAttrs(rows, { class: 'oc-race-rows', 'clip-path': `url(#${clipId})` });
  const period = createSVGElement('text');
  setAttrs(period, { class: 'oc-race-period', 'text-anchor': 'end' });
  const summary = createSVGElement('text');
  setAttrs(summary, { class: 'oc-race-summary', 'text-anchor': 'end' });
  const owned = [defs, axis, period, summary, rows];
  host.append(...owned);

  const rowNodes = new Map<
    string,
    { group: SVGElement; bar: SVGElement; name: SVGElement; value: SVGElement }
  >();
  const tickNodes = new Map<number, { group: SVGElement; line: SVGElement; label: SVGElement }>();
  let visibleKeys = new Set<string>();
  let destroyed = false;

  function createRow(key: string) {
    const group = createSVGElement('g');
    group.setAttribute('data-key', key);
    const bar = createSVGElement('rect');
    const name = createSVGElement('text');
    setAttrs(name, { 'text-anchor': 'end', 'dominant-baseline': 'central' });
    const value = createSVGElement('text');
    value.setAttribute('dominant-baseline', 'central');
    group.append(bar, name, value);
    const nodes = { group, bar, name, value };
    rowNodes.set(key, nodes);
    return nodes;
  }

  function createTick(value: number) {
    const group = createSVGElement('g');
    const line = createSVGElement('line');
    setNumbers(line, { y1: stat.plot.y, y2: stat.plot.y + stat.plot.height });
    const label = createSVGElement('text');
    label.setAttribute('text-anchor', 'middle');
    setNumbers(label, { 'font-size': stat.tickFontSize });
    group.append(line, label);
    axis.append(group);
    const nodes = { group, line, label };
    tickNodes.set(value, nodes);
    return nodes;
  }

  return {
    draw(geometry) {
      if (destroyed) return;

      const activeTicks = new Set<number>();
      for (const tick of geometry.ticks) {
        const { value, position, opacity, label } = tick;
        const nodes = tickNodes.get(value) ?? createTick(value);
        activeTicks.add(value);
        setNumbers(nodes.group, { opacity });
        setNumbers(nodes.line, { x1: position, x2: position });
        drawText(nodes.label, { x: position, y: stat.axisY, text: label });
      }
      for (const [value, { group }] of tickNodes) {
        if (activeTicks.has(value)) continue;
        group.remove();
        tickNodes.delete(value);
      }

      const nextKeys = new Set<string>();
      let nextRow = rows.firstElementChild;
      for (const row of geometry.rows) {
        const nodes = rowNodes.get(row.key) ?? createRow(row.key);
        if (nodes.group === nextRow) nextRow = nextRow.nextElementSibling;
        else rows.insertBefore(nodes.group, nextRow);
        nextKeys.add(row.key);
        if (!visibleKeys.has(row.key)) nodes.group.removeAttribute('display');
        setNumbers(nodes.group, { opacity: row.opacity });
        const { x, y, width, height } = row.bar;
        const radius = Math.min(stat.cornerRadius, height / 2);
        setNumbers(nodes.bar, { x, y, width, height, rx: radius, ry: radius });
        nodes.bar.setAttribute('fill', row.color);
        drawText(nodes.name, row.name);
        nodes.value.setAttribute('text-anchor', row.value.anchor);
        drawText(nodes.value, row.value);
      }
      for (const key of visibleKeys) {
        if (!nextKeys.has(key)) rowNodes.get(key)?.group.setAttribute('display', 'none');
      }
      visibleKeys = nextKeys;

      drawText(period, geometry.period);
      if (geometry.period) setNumbers(period, { 'font-size': geometry.period.fontSize });
      drawText(summary, geometry.summary);
    },
    destroy() {
      destroyed = true;
      for (const element of owned) element.remove();
      rowNodes.clear();
      tickNodes.clear();
      visibleKeys.clear();
    },
  };
}
