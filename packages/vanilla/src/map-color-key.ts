import type {
  GeoColorKeyLayout,
  GeoMapLayout,
  GeoReaderSelection,
} from '@opendata-ai/openchart-core';
import { buildD3Formatter, formatNumber } from '@opendata-ai/openchart-core';
import { type GeoReaderIndex, geoColorKeyPosition } from '@opendata-ai/openchart-engine';

const NS = 'http://www.w3.org/2000/svg';
const node = (tag: string, attrs: Record<string, string | number>, content?: string) => {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (content !== undefined) el.textContent = content;
  return el;
};
const text = (layout: GeoMapLayout, x: number, y: number, value: string) =>
  node(
    'text',
    {
      x,
      y,
      fill: layout.theme.colors.text,
      'font-family': layout.theme.fonts.family,
      'font-size': layout.theme.fonts.sizes.small,
    },
    value,
  );
export function renderStaticGeoColorKeys(svg: SVGSVGElement, layout: GeoMapLayout) {
  if (!layout.colorKeys) return;
  for (const [scope, key] of Object.entries(layout.colorKeys) as Array<
    ['features' | 'points', GeoColorKeyLayout]
  >) {
    const bounds = key?.distributionBounds;
    if (!key?.distribution || !bounds) continue;
    const group = node('g', { 'data-geo-distribution': scope, role: 'img' });
    const line = Math.ceil(layout.theme.fonts.sizes.small * 1.4);
    const noun = scope === 'features' ? 'Regions' : 'Points';
    group.append(
      text(layout, bounds.x, bounds.y + layout.theme.fonts.sizes.small, `${noun} per range`),
    );
    group.append(
      text(
        layout,
        bounds.x,
        bounds.y + line + layout.theme.fonts.sizes.small,
        `No data: ${key.missing}`,
      ),
    );
    const bars =
      key.kind === 'categorical'
        ? key.categories.map((category, index) => ({
            count: category.count,
            color: category.color,
            label: category.value,
            x: bounds.x + (index * bounds.width) / Math.max(1, key.categories.length),
            width: bounds.width / Math.max(1, key.categories.length),
          }))
        : key.classes.map((bin, index) => ({
            ...bin,
            x: bounds.x + (index * bounds.width) / Math.max(1, key.classes.length),
            width: bounds.width / Math.max(1, key.classes.length),
            label: `${bin.lower ?? '−∞'} to ${bin.upper ?? '∞'}`,
          }));
    const max = Math.max(1, ...bars.map((bar) => bar.count));
    const chartY = bounds.y + line * 2 + 4;
    for (const bar of bars) {
      const height = (20 * bar.count) / max;
      const rectangle = node('rect', {
        x: bar.x,
        y: chartY + 20 - height,
        width: Math.max(1, bar.width - 2),
        height,
        fill: bar.color,
      });
      rectangle.append(node('title', {}, `${bar.label}: ${bar.count} ${noun.toLowerCase()}`));
      group.append(rectangle);
      const label = text(
        layout,
        bar.x + bar.width / 2,
        chartY + 20 + layout.theme.fonts.sizes.small,
        String(bar.count),
      );
      label.setAttribute('text-anchor', 'middle');
      group.append(label);
    }
    group.setAttribute(
      'aria-label',
      `${noun} per range. ${bars.map((bar) => `${bar.label}: ${bar.count}`).join('; ')}. No data: ${key.missing}.`,
    );
    svg.append(group);
  }
}
export function renderActiveGeoColorKeys(
  parent: SVGElement,
  layout: GeoMapLayout,
  index: GeoReaderIndex,
  selection: GeoReaderSelection,
) {
  if (!layout.colorKeys) return;
  const active = selection.pinned.length
    ? selection.pinned
    : selection.preview
      ? [selection.preview]
      : [];
  for (const [scope, key] of Object.entries(layout.colorKeys) as Array<
    ['features' | 'points', GeoColorKeyLayout]
  >) {
    if (!key?.activeValue) continue;
    for (const [slot, observation] of active.entries()) {
      if ((scope === 'features') !== (observation.entity.kind === 'feature')) continue;
      const record = index.byObservation.get(observation.observation);
      const row = key.activeRows[slot];
      if (!record || !row) continue;
      const value = record.color?.value;
      const position = geoColorKeyPosition(key, value);
      const format = key.format ? buildD3Formatter(key.format) : undefined;
      const exact =
        typeof value === 'number'
          ? format
            ? format(value)
            : formatNumber(value)
          : value === ''
            ? '(empty)'
            : String(value ?? 'No data');
      const suffix = position.missing
        ? 'No data'
        : `${exact}${position.outside ? ' · outside displayed range' : ''}`;
      const lines = key.activeLabels?.[`${typeof value}:${String(value)}`] ?? [`A: ${suffix}`];
      const advance = Math.ceil(layout.theme.fonts.sizes.small * 1.4);
      for (const [lineIndex, line] of lines.entries()) {
        const label = text(
          layout,
          row.x,
          row.y + layout.theme.fonts.sizes.small + lineIndex * advance,
          lineIndex === 0 ? line.replace(/^A:/, `${slot === 0 ? 'A' : 'B'}:`) : line,
        );
        label.setAttribute('data-geo-active-value', scope);
        if (key.kind === 'binned') {
          const title = node(
            'title',
            {},
            `${suffix}; marker identifies the range containing this value`,
          );
          label.append(title);
        }
        parent.append(label);
      }
      if (position.category !== undefined) {
        const category = key.categories.find((category) => category.value === position.category);
        if (category)
          parent.append(
            node('rect', {
              ...category.bounds,
              fill: 'none',
              stroke: layout.theme.colors.text,
              'stroke-width': 2,
            }),
          );
      } else if (position.x !== undefined && key.bar)
        parent.append(
          node('path', {
            d:
              position.y === undefined
                ? `M${position.x - 3},${key.bar.y - 4} L${position.x},${key.bar.y} L${position.x + 3},${key.bar.y - 4}`
                : `M${position.x - 14},${position.y - 3} L${position.x - 10},${position.y} L${position.x - 14},${position.y + 3}`,
            stroke: layout.theme.colors.text,
            'stroke-width': 2,
            fill: 'none',
          }),
        );
    }
  }
}
