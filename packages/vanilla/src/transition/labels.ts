import type { ChartLayout } from '@opendata-ai/openchart-core';
import type { GeometrySnapshot } from './types';

/** Attached text and endpoint markers follow the same sampled progress as marks. */
export function buildLabelMotion(
  svg: SVGSVGElement,
  previous: ChartLayout,
  next: ChartLayout,
  snapshot?: GeometrySnapshot,
) {
  const attributes: Array<{
    element: Element;
    name: string;
    from: number;
    to: number;
    key: string;
  }> = [];
  const add = (element: Element, name: string, delta: number, key: string) => {
    const raw = element.getAttribute(name);
    if (raw === null) return;
    const to = Number(raw);
    if (!Number.isFinite(to)) return;
    const captured = snapshot?.get(key);
    attributes.push({
      element,
      name,
      from: captured?.type === 'attribute' ? captured.value : to + delta,
      to,
      key,
    });
  };
  for (const group of svg.querySelectorAll('[data-endpoint-key]')) {
    const key = group.getAttribute('data-endpoint-key');
    const leading = group.getAttribute('data-endpoint-side') === 'leading';
    const before = (
      leading ? previous.endpointLabels?.leading : previous.endpointLabels?.entries
    )?.find((entry) => entry.seriesKey === key);
    const after = (leading ? next.endpointLabels?.leading : next.endpointLabels?.entries)?.find(
      (entry) => entry.seriesKey === key,
    );
    if (!before || !after) continue;
    const beforeBounds = leading
      ? previous.endpointLabels?.leadingBounds
      : previous.endpointLabels?.bounds;
    const afterBounds = leading ? next.endpointLabels?.leadingBounds : next.endpointLabels?.bounds;
    const dx = (beforeBounds?.x ?? 0) - (afterBounds?.x ?? 0);
    const dy = before.labelY - after.labelY;
    Array.from(group.querySelectorAll('text, tspan, line, circle')).forEach((element, index) => {
      const marker = element.classList.contains('oc-endpoint-marker');
      const leader = element.classList.contains('oc-endpoint-leader');
      const prefix = `endpoint:${key}:${leading}:${index}`;
      for (const name of ['x', 'x1', 'x2', 'cx']) {
        const offset = marker
          ? (before.marker?.x ?? 0) - (after.marker?.x ?? 0)
          : leader && name === 'x2'
            ? previous.area.x +
              (leading ? 0 : previous.area.width) -
              next.area.x -
              (leading ? 0 : next.area.width)
            : dx;
        add(element, name, offset, `${prefix}:${name}`);
      }
      for (const name of ['y', 'y1', 'y2', 'cy']) {
        const offset = marker || (leader && name === 'y2') ? before.dataY - after.dataY : dy;
        add(element, name, offset, `${prefix}:${name}`);
      }
    });
  }
  const beforeMarks = new Map(
    previous.marks.filter((mark) => mark.key).map((mark) => [mark.key, mark]),
  );
  const afterMarks = new Map(next.marks.filter((mark) => mark.key).map((mark) => [mark.key, mark]));
  for (const label of svg.querySelectorAll('[data-label-key]')) {
    const key = label.getAttribute('data-label-key')!;
    const before = beforeMarks.get(key);
    const after = afterMarks.get(key);
    if (
      !before ||
      !after ||
      !('label' in before) ||
      !('label' in after) ||
      !before.label ||
      !after.label
    )
      continue;
    // Arc labels are local to a translated mark group. Its center already
    // follows the arc tween, so only the local label offset belongs here.
    const dx = before.type === 'arc' && after.type === 'arc' ? before.center.x - after.center.x : 0;
    const dy = before.type === 'arc' && after.type === 'arc' ? before.center.y - after.center.y : 0;
    add(label, 'x', before.label.x - after.label.x - dx, `label:${key}:x`);
    add(label, 'y', before.label.y - after.label.y - dy, `label:${key}:y`);
  }
  let progress = 0;
  return {
    apply(value: number) {
      progress = value;
      for (const item of attributes)
        item.element.setAttribute(item.name, String(item.from + (item.to - item.from) * value));
    },
    snapshot(target: GeometrySnapshot) {
      for (const item of attributes)
        target.set(item.key, {
          type: 'attribute',
          value: item.from + (item.to - item.from) * progress,
        });
    },
  };
}
