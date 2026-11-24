import type { Point, RaceTick } from '@opendata-ai/openchart-core';
import { defaultElementFactory, type ElementFactory, setAttrs } from '../renderers/svg-dom';
import type { RaceRendererFactory } from './renderers';
import { setNumbers } from './svg-attrs';

function linePath(points: Array<Point | null>): string {
  const commands: string[] = [];
  let command = 'M';
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
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
  createSVGElement: ElementFactory['svg'],
  {
    grid,
    alignPeriodLabels,
  }: { grid?: { left: number; right: number }; alignPeriodLabels?: boolean } = {},
) {
  const nodes = new Map<number, ReturnType<typeof createTick>>();

  function createTick(value: number) {
    const group = createSVGElement('g');
    const label = createSVGElement('text');
    setNumbers(label, { 'font-size': fontSize });
    if (alignPeriodLabels) {
      setAttrs(label, { 'text-anchor': value === 0 ? 'end' : 'start', dx: value === 0 ? -2 : 2 });
    }
    const line = grid && createSVGElement('line');
    if (line && grid) {
      setNumbers(line, { x1: grid.left, x2: grid.right });
      group.append(line);
    }
    group.append(label);
    const tick = { group, label, line };
    nodes.set(value, tick);
    return tick;
  }

  return {
    draw(ticks: RaceTick[], fixed: number) {
      const active = new Set<number>();
      let next = axis.firstElementChild;
      for (const tick of ticks) {
        const { group, label, line } = nodes.get(tick.value) ?? createTick(tick.value);
        active.add(tick.value);
        if (group === next) next = next.nextElementSibling;
        else axis.insertBefore(group, next);
        setNumbers(group, { opacity: tick.opacity });
        if (line && grid) {
          setNumbers(line, { y1: tick.position, y2: tick.position });
          setNumbers(label, { x: fixed, y: tick.labelPosition ?? tick.position });
          if (tick.labelOpacity !== undefined) setNumbers(label, { opacity: tick.labelOpacity });
          else label.removeAttribute('opacity');
        } else {
          setNumbers(label, { x: tick.position, y: fixed });
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
export const createRaceLineRenderer: RaceRendererFactory<'line'> = (
  host,
  stat,
  idScope,
  { svg: createSVGElement } = defaultElementFactory,
) => {
  const { x, y, width, height } = stat.plot;
  const clipId = `${idScope}-race-line-clip`;
  const root = createSVGElement('g');
  root.setAttribute('class', 'oc-race-line');
  const clip = createSVGElement('clipPath');
  clip.setAttribute('id', clipId);
  const rect = createSVGElement('rect');
  setNumbers(rect, { x, y, width, height });
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
  const leaders = createSVGElement('g');
  const labels = createSVGElement('g');
  labels.setAttribute('class', 'oc-race-line-labels');
  root.append(defs, axis, paths, leaders, labels);
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
    const label = createSVGElement('text');
    label.setAttribute('data-key', key);
    const name = createSVGElement('tspan');
    const value = createSVGElement('tspan');
    value.setAttribute('class', 'oc-race-line-value');
    label.append(name, value);
    const leader = createSVGElement('line');
    setAttrs(leader, {
      class: 'oc-race-line-leader',
      'data-key': key,
      stroke: 'var(--oc-text-muted)',
      'stroke-width': 0.8,
    });
    return { path, label, name, value, leader };
  }

  const seriesNodes = new Map<string, ReturnType<typeof createSeries>>();
  const xTicks = tickAxis(xAxis, stat.tickFontSize, createSVGElement, {
    alignPeriodLabels: stat.window === 'all',
  });
  const yTicks = tickAxis(yAxis, stat.tickFontSize, createSVGElement, {
    grid: { left: stat.yAxisX, right: x + width },
  });
  let destroyed = false;

  return {
    draw(geometry) {
      if (destroyed) return;

      xTicks.draw(geometry.xTicks, y + height + stat.tickFontSize + 2);
      yTicks.draw(geometry.yTicks, stat.yAxisX - 4);

      const active = new Set<string>();
      const paintedLeaders = new Map<string, SVGElement>();
      let nextPath = paths.firstElementChild;
      let nextLabel = labels.firstElementChild;
      let nextLeader = leaders.firstElementChild;
      for (const series of geometry.series) {
        const { key, color, opacity, points, endLabel } = series;
        const nodes = seriesNodes.get(key) ?? createSeries(key);
        seriesNodes.set(key, nodes);
        active.add(key);
        if (nodes.path === nextPath) nextPath = nextPath.nextElementSibling;
        else paths.insertBefore(nodes.path, nextPath);
        if (nodes.label === nextLabel) nextLabel = nextLabel.nextElementSibling;
        else labels.insertBefore(nodes.label, nextLabel);
        setAttrs(nodes.path, { d: linePath(points), stroke: color });
        setNumbers(nodes.path, { opacity });
        const labelOpacity = endLabel.opacity ?? opacity;
        setNumbers(nodes.label, { x: endLabel.x, y: endLabel.y, opacity: labelOpacity });
        const leader = endLabel.leader;
        let paintLeader = false;
        if (leader) {
          setNumbers(nodes.leader, {
            x1: leader.x,
            y1: leader.y,
            x2: endLabel.x - 1,
            y2: endLabel.y,
            opacity: leader.opacity,
          });
          const coordinates = ['x1', 'y1', 'x2', 'y2']
            .map((attribute) => nodes.leader.getAttribute(attribute))
            .join(',');
          const painted = paintedLeaders.get(coordinates);
          if (painted) {
            // Tied series can temporarily share an endpoint and label slot.
            setNumbers(painted, {
              opacity: Math.max(Number(painted.getAttribute('opacity')), leader.opacity),
            });
          } else {
            paintedLeaders.set(coordinates, nodes.leader);
            paintLeader = true;
          }
        }
        if (nodes.leader === nextLeader) nextLeader = nextLeader.nextElementSibling;
        else if (paintLeader) leaders.insertBefore(nodes.leader, nextLeader);
        if (!paintLeader) nodes.leader.remove();
        nodes.name.setAttribute('fill', color);
        if (nodes.name.textContent !== endLabel.text) nodes.name.textContent = endLabel.text;
        const value = endLabel.text && endLabel.value ? ` ${endLabel.value}` : endLabel.value;
        if (nodes.value.textContent !== value) nodes.value.textContent = value;
      }
      for (const [key, { path, label, leader }] of seriesNodes) {
        if (active.has(key)) continue;
        path.remove();
        label.remove();
        leader.remove();
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
