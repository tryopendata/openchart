import type { Point, RaceTick } from '@opendata-ai/openchart-core';
import { createSVGElement, setAttrs } from '../renderers/svg-dom';
import type { RaceRendererFactory } from './renderers';

function linePath(points: Array<Point | null>): string {
  const commands: string[] = [];
  let command = 'M';
  for (const point of points) {
    if (!point) {
      command = 'M';
      continue;
    }
    commands.push(`${command}${point.x.toFixed(2)},${point.y.toFixed(2)}`);
    command = 'L';
  }
  return commands.join('');
}

function tickAxis(
  axis: SVGElement,
  fontSize: number,
  {
    grid,
    alignPeriodLabels,
  }: { grid?: { left: number; right: number }; alignPeriodLabels?: boolean } = {},
) {
  const nodes = new Map<number, ReturnType<typeof createTick>>();

  function createTick(value: number) {
    const group = createSVGElement('g');
    const label = createSVGElement('text');
    setAttrs(label, { 'font-size': fontSize });
    if (alignPeriodLabels) {
      setAttrs(label, { 'text-anchor': value === 0 ? 'end' : 'start', dx: value === 0 ? -2 : 2 });
    }
    const line = grid && createSVGElement('line');
    if (line && grid) {
      setAttrs(line, { x1: grid.left, x2: grid.right });
      group.append(line);
    }
    group.append(label);
    axis.append(group);
    const tick = { group, label, line };
    nodes.set(value, tick);
    return tick;
  }

  return {
    draw(ticks: RaceTick[], fixed: number) {
      const active = new Set<number>();
      for (const tick of ticks) {
        const { group, label, line } = nodes.get(tick.value) ?? createTick(tick.value);
        active.add(tick.value);
        group.setAttribute('opacity', String(tick.opacity));
        if (line) {
          setAttrs(line, { y1: tick.position, y2: tick.position });
          setAttrs(label, { x: fixed, y: tick.position });
        } else {
          setAttrs(label, { x: tick.position, y: fixed });
        }
        if (label.textContent !== tick.label) label.textContent = tick.label;
      }
      for (const [value, { group }] of nodes) {
        if (active.has(value)) continue;
        group.remove();
        nodes.delete(value);
      }
    },
    clear: () => nodes.clear(),
  };
}

/** Mount and update keyed series and axis ticks in the shell's SVG mark host. */
export const createRaceLineRenderer: RaceRendererFactory<'line'> = (host, stat, idScope) => {
  const { x, y, width, height } = stat.plot;
  const clipId = `${idScope}-race-line-clip`;
  const root = createSVGElement('g');
  root.setAttribute('class', 'oc-race-line');
  const clip = createSVGElement('clipPath');
  clip.setAttribute('id', clipId);
  const rect = createSVGElement('rect');
  setAttrs(rect, { x, y, width, height });
  clip.append(rect);
  const defs = createSVGElement('defs');
  defs.append(clip);
  const axis = createSVGElement('g');
  axis.setAttribute('class', 'oc-race-axis');
  const xAxis = createSVGElement('g');
  xAxis.setAttribute('text-anchor', 'middle');
  const yAxis = createSVGElement('g');
  setAttrs(yAxis, { 'text-anchor': 'end', 'dominant-baseline': 'central' });
  axis.append(yAxis, xAxis);
  const paths = createSVGElement('g');
  const labels = createSVGElement('g');
  labels.setAttribute('class', 'oc-race-line-labels');
  root.append(defs, axis, paths, labels);
  host.append(root);

  function createSeries(key: string) {
    const path = createSVGElement('path');
    setAttrs(path, {
      'data-key': key,
      fill: 'none',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'clip-path': `url(#${clipId})`,
    });
    paths.append(path);
    const label = createSVGElement('text');
    const name = createSVGElement('tspan');
    const value = createSVGElement('tspan');
    value.setAttribute('fill', 'var(--oc-text-muted)');
    label.append(name, value);
    labels.append(label);
    return { path, label, name, value };
  }

  const seriesNodes = new Map<string, ReturnType<typeof createSeries>>();
  const xTicks = tickAxis(xAxis, stat.tickFontSize, { alignPeriodLabels: stat.window === 'all' });
  const yTicks = tickAxis(yAxis, stat.tickFontSize, {
    grid: { left: stat.yAxisX, right: x + width },
  });
  let destroyed = false;

  return {
    draw(geometry) {
      if (destroyed) return;

      xTicks.draw(geometry.xTicks, y + height + stat.tickFontSize + 2);
      yTicks.draw(geometry.yTicks, stat.yAxisX - 4);

      const active = new Set<string>();
      for (const series of geometry.series) {
        const { key, color, opacity, points, endLabel } = series;
        const nodes = seriesNodes.get(key) ?? createSeries(key);
        seriesNodes.set(key, nodes);
        active.add(key);
        setAttrs(nodes.path, { d: linePath(points), stroke: color, opacity });
        setAttrs(nodes.label, { x: endLabel.x, y: endLabel.y, opacity });
        nodes.name.setAttribute('fill', color);
        if (nodes.name.textContent !== endLabel.text) nodes.name.textContent = endLabel.text;
        const value = endLabel.text && endLabel.value ? ` ${endLabel.value}` : endLabel.value;
        if (nodes.value.textContent !== value) nodes.value.textContent = value;
      }
      for (const [key, { path, label }] of seriesNodes) {
        if (active.has(key)) continue;
        path.remove();
        label.remove();
        seriesNodes.delete(key);
      }
    },
    destroy() {
      destroyed = true;
      root.remove();
      seriesNodes.clear();
      xTicks.clear();
      yTicks.clear();
    },
  };
};
