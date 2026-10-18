/**
 * Layout signature for the v8 -> v9 migration parity test.
 *
 * Shared verbatim by `scripts/capture-v8-parity.mjs` (which copies this file into
 * a temporary v8.9.1 worktree) and `migration-v8-parity.test.ts`, so both sides
 * extract with identical code. Keep it dependency-free: it reads layouts loosely
 * because it runs against two engine versions and every compiled layout kind
 * (chart/layer/facet, table, graph, sankey, tilemap, geo map, barlist).
 *
 * Field mapping 8.9.1 -> v9: the layout types are identical for everything read
 * here. v9 adds `AnnotationFootnote.subtitle/spans` (not read; notes compare
 * `index`, `text` and `lines`) and drops `TableLayout.compact` (not read).
 *
 * - `style`: everything the RFC promises migration keeps (fonts, colors, text,
 *   weights, mark paint, annotation ink, connectors and arrows). Compared exactly.
 * - `geometry`: flattened `category -> path -> value` maps. Numbers are rounded to
 *   0.01px; strings (tick labels, note text) are content whose placement depends
 *   on layout, so they count as geometry differences rather than style.
 */

// biome-ignore lint/suspicious/noExplicitAny: layouts are read loosely across two engine versions.
type Any = any;

export type GeometryValue = number | string | null;
export type Geometry = Record<string, Record<string, GeometryValue>>;
export interface Signature {
  style: Record<string, unknown>;
  geometry: Geometry;
}

export const GEOMETRY_CATEGORIES = [
  'dims',
  'area',
  'chrome',
  'axes',
  'marks',
  'labels',
  'annotations',
  'legend',
  'endpointLabels',
  'notes',
] as const;

const round = (value: unknown, places: number): unknown => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  }
  if (Array.isArray(value)) return value.map((item) => round(item, places));
  if (value && typeof value === 'object') {
    if (value instanceof Map) return round(Object.fromEntries(value), places);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined && typeof child !== 'function') out[key] = round(child, places);
    }
    return out;
  }
  return value === undefined ? null : value;
};
const clean = (value: unknown) => round(value, 3);

const textStyle = (style: Any) =>
  style
    ? clean({
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fill: style.fill,
        lineHeight: style.lineHeight,
        fontVariant: style.fontVariant,
      })
    : null;

const connectorStyle = (connector: Any) =>
  connector
    ? {
        style: connector.style ?? null,
        arrow: connector.arrow ?? null,
        stroke: connector.stroke ?? null,
      }
    : null;

const labelStyle = (label: Any) =>
  label
    ? {
        text: label.text ?? null,
        style: textStyle(label.style),
        background: label.background ?? null,
        halo: label.halo ?? null,
        connector: connectorStyle(label.connector),
      }
    : null;

function markStyle(mark: Any) {
  return clean({
    type: mark.type ?? null,
    key: mark.key ?? mark.nodeId ?? mark.stateCode ?? mark.id ?? null,
    series: mark.seriesKey ?? null,
    fill: mark.fill ?? mark.bar?.fill ?? null,
    stroke: mark.stroke ?? null,
    strokeWidth: mark.strokeWidth ?? null,
    strokeDasharray: mark.strokeDasharray ?? null,
    opacity: mark.opacity ?? null,
    fillOpacity: mark.fillOpacity ?? null,
    strokeOpacity: mark.strokeOpacity ?? null,
    pattern: mark.pattern ?? null,
    cornerRadius: mark.cornerRadius ?? mark.bar?.cornerRadius ?? null,
    sourceColor: mark.sourceColor ?? null,
    targetColor: mark.targetColor ?? null,
    noData: mark.noData ?? null,
    text: mark.type === 'textMark' ? mark.text : null,
    font:
      mark.type === 'textMark'
        ? { fontSize: mark.fontSize, fontWeight: mark.fontWeight, fontFamily: mark.fontFamily }
        : null,
    label: labelStyle(mark.label),
    subtitle: labelStyle(mark.subtitle),
    valueLabel: mark.valueLabel
      ? { text: mark.valueLabel.text ?? null, style: textStyle(mark.valueLabel.style) }
      : null,
  });
}

/** Bounding box of the first two coordinates of every path command (no arcs). */
function pathBox(path: unknown) {
  if (typeof path !== 'string' || /[aA]/.test(path)) return null;
  const numbers = path.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    xs.push(numbers[i]);
    ys.push(numbers[i + 1]);
  }
  return pointsBox(xs.map((x, i) => ({ x, y: ys[i] })));
}

function pointsBox(points: Any[] | undefined) {
  const finite = (points ?? []).filter(
    (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (!finite.length) return null;
  const xs = finite.map((point) => point.x);
  const ys = finite.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function markBounds(mark: Any): Record<string, unknown> | null {
  switch (mark.type) {
    case 'rect':
    case 'sankeyNode':
      return { x: mark.x, y: mark.y, width: mark.width, height: mark.height };
    case 'point':
    case 'map-point':
      return { cx: mark.cx, cy: mark.cy, r: mark.r };
    case 'line':
      return pointsBox(mark.points) ?? pathBox(mark.path);
    case 'area':
      return pointsBox([...(mark.topPoints ?? []), ...(mark.bottomPoints ?? [])]);
    case 'arc':
      return {
        cx: mark.center?.x,
        cy: mark.center?.y,
        innerRadius: mark.innerRadius,
        outerRadius: mark.outerRadius,
        startAngle: mark.startAngle,
        endAngle: mark.endAngle,
      };
    case 'textMark':
      return { x: mark.x, y: mark.y };
    case 'rule':
      return { x1: mark.x1, y1: mark.y1, x2: mark.x2, y2: mark.y2 };
    case 'tick':
      return { x: mark.x, y: mark.y, length: mark.length };
    case 'sankeyLink':
      return { width: mark.width, ...pathBox(mark.path) };
    case 'tile':
      return { x: mark.x, y: mark.y, size: mark.size };
    case 'map-feature':
      return mark.bounds ?? null;
    case 'barlist-row':
      return { bar: mark.bar, track: mark.track, y: mark.y, height: mark.height };
    default:
      return null;
  }
}

function legendsOf(layout: Any): Array<[string, Any]> {
  const named: Array<[string, Any]> = [];
  if (Array.isArray(layout.legends) && layout.legends.length)
    for (const [i, legend] of layout.legends.entries()) named.push([`legends.${i}`, legend]);
  else if (layout.legend) named.push(['legend', layout.legend]);
  for (const key of [
    'gradientLegend',
    'categoricalLegend',
    'continuousLegend',
    'pointCategoricalLegend',
    'pointContinuousLegend',
    'pointSizeLegend',
  ])
    if (layout[key]) named.push([key, layout[key]]);
  return named;
}

function legendStyle(legend: Any) {
  return clean({
    type: legend.type ?? 'categorical',
    channel: legend.channel ?? null,
    position: legend.position ?? null,
    labelStyle: textStyle(legend.labelStyle),
    titleStyle: textStyle(legend.titleStyle),
    title: legend.title ?? null,
    entries: (legend.entries ?? []).map((entry: Any) => ({
      label: entry.label,
      color: entry.color,
      shape: entry.shape,
      active: entry.active ?? null,
      overflow: entry.overflow ?? null,
    })),
    swatchChipFill: legend.swatchChipFill ?? null,
    colorStops: legend.colorStops ?? null,
    bins: (legend.bins ?? []).map((bin: Any) => bin.color),
    ticks: (legend.ticks ?? []).map((tick: Any) => tick.label),
    circles: (legend.circles ?? []).map((circle: Any) => circle.label),
    minLabel: legend.minLabel ?? null,
    maxLabel: legend.maxLabel ?? null,
    stroke: legend.stroke ?? null,
    noData: legend.noData
      ? { fill: legend.noData.fill, label: legend.noData.label, pattern: legend.noData.pattern }
      : null,
  });
}

function annotationStyle(annotation: Any) {
  return clean({
    type: annotation.type,
    id: annotation.id ?? null,
    label: labelStyle(annotation.label),
    subtitle: annotation.subtitle
      ? { text: annotation.subtitle.text, style: textStyle(annotation.subtitle.style) }
      : null,
    fill: annotation.fill ?? null,
    stroke: annotation.stroke ?? null,
    opacity: annotation.opacity ?? null,
    strokeDasharray: annotation.strokeDasharray ?? null,
    strokeWidth: annotation.strokeWidth ?? null,
    dot: annotation.dot
      ? {
          fill: annotation.dot.fill,
          stroke: annotation.dot.stroke,
          strokeWidth: annotation.dot.strokeWidth,
          radius: annotation.dot.radius,
        }
      : null,
  });
}

const annotationKey = (annotation: Any, index: number) =>
  `a${annotation.specIndex ?? `#${index}`}${annotation.id ? `:${annotation.id}` : ''}`;

function axesStyle(axes: Any) {
  const out: Record<string, unknown> = {};
  for (const name of ['x', 'y', 'y2']) {
    const axis = axes?.[name];
    if (!axis) continue;
    out[name] = {
      title: axis.label ?? null,
      titleStyle: textStyle(axis.labelStyle),
      tickStyle: textStyle(axis.tickLabelStyle),
    };
  }
  return out;
}

const CHROME_KEYS = ['eyebrow', 'title', 'subtitle', 'source', 'byline', 'footer', 'brand'];

/** Extract the parity signature from any compiled layout. */
export function signature(layout: Any): Signature {
  const geometry: Geometry = {};
  for (const category of GEOMETRY_CATEGORIES) geometry[category] = {};
  const put = (category: string, path: string, value: unknown) => {
    const rounded = round(value, 2);
    if (rounded && typeof rounded === 'object') {
      for (const [key, child] of Object.entries(rounded as Record<string, unknown>))
        put(category, `${path}.${key}`, child);
      return;
    }
    geometry[category][path] = rounded as GeometryValue;
  };

  const theme = layout.theme ?? {};
  const style: Record<string, unknown> = {
    theme: clean({
      colors: theme.colors,
      fonts: theme.fonts,
      chrome: theme.chrome,
      rule: theme.rule,
      spacing: theme.spacing,
      borderRadius: theme.borderRadius,
      isDark: theme.isDark,
      seriesStrategy: theme.seriesStrategy,
    }),
  };

  // Dimensions and plot area.
  put('dims', 'size', layout.dimensions ?? { width: layout.width, height: layout.height });
  if (layout.mapSize) put('dims', 'mapSize', layout.mapSize);
  if (layout.area) put('area', 'rect', layout.area);

  // Chrome.
  const chrome = layout.chrome ?? {};
  const chromeStyle: Record<string, unknown> = {};
  for (const key of CHROME_KEYS) {
    const element = chrome[key];
    if (!element) continue;
    chromeStyle[key] = { text: element.text, style: textStyle(element.style) };
    put('chrome', key, { x: element.x, y: element.y, maxWidth: element.maxWidth });
  }
  if (chrome.rule) {
    chromeStyle.rule = clean({ color: chrome.rule.color, thickness: chrome.rule.thickness });
    put('chrome', 'rule', { x: chrome.rule.x, y: chrome.rule.y, width: chrome.rule.width });
  }
  chromeStyle.seriesSummary = clean(
    (chrome.seriesSummary ?? []).map((entry: Any) => ({ key: entry.key, color: entry.color })),
  );
  style.chrome = chromeStyle;
  for (const key of ['topHeight', 'bottomHeight', 'noteBandHeight', 'grownHeight', 'bottomAnchorY'])
    if (chrome[key] !== undefined) put('chrome', key, chrome[key]);
  (chrome.footnotes ?? []).forEach((note: Any, i: number) => {
    put('notes', `${i}.index`, note.index);
    put('notes', `${i}.text`, note.text);
    put('notes', `${i}.lines`, (note.lines ?? []).join('\n'));
  });
  for (const [i, entry] of (chrome.seriesSummary ?? []).entries())
    put('notes', `summary.${i}`, (entry.lines ?? [entry.text]).join('\n'));

  // Axes, marks, annotations: the chart body and every facet panel.
  const bodies: Array<[string, Any]> = [['', layout]];
  for (const panel of layout.facet?.panels ?? []) bodies.push([`facet[${panel.key}].`, panel]);
  if (layout.facet) {
    style.facetHeaders = clean(
      layout.facet.panels.map((panel: Any) => ({
        text: panel.header?.text,
        fontSize: panel.header?.fontSize,
        fontWeight: panel.header?.fontWeight,
      })),
    );
    for (const panel of layout.facet.panels) {
      put('area', `facet[${panel.key}]`, panel.area);
      put('chrome', `facet[${panel.key}].header`, { x: panel.header?.x, y: panel.header?.y });
    }
  }

  const axesStyles: Record<string, unknown> = {};
  const markStyles: Record<string, unknown> = {};
  const annotationStyles: Record<string, unknown> = {};
  for (const [prefix, body] of bodies) {
    if (body.axes) {
      axesStyles[prefix || 'root'] = axesStyle(body.axes);
      for (const name of ['x', 'y', 'y2']) {
        const axis = body.axes[name];
        if (!axis) continue;
        const at = `${prefix}${name}`;
        put('axes', `${at}.start`, axis.start);
        put('axes', `${at}.end`, axis.end);
        put('axes', `${at}.tickAngle`, axis.tickAngle ?? 0);
        put('axes', `${at}.titlePosition`, axis.titlePosition ?? null);
        put('axes', `${at}.gridlines`, axis.gridlines?.length ?? 0);
        (axis.ticks ?? []).forEach((tick: Any, i: number) => {
          put('axes', `${at}.tick.${i}.position`, tick.position);
          put('axes', `${at}.tick.${i}.label`, tick.label);
        });
      }
    }

    const marks: Any[] = [
      ...(body.marks ?? []),
      ...(prefix ? [] : [...(layout.nodes ?? []), ...(layout.links ?? [])]),
      ...(prefix ? [] : [...(layout.tiles ?? []), ...(layout.features ?? [])]),
      ...(prefix ? [] : [...(layout.pointMarks ?? []), ...(layout.rows ?? [])]),
    ].filter((mark) => mark && typeof mark === 'object' && typeof mark.type === 'string');
    marks.forEach((mark, i) => {
      const at = `${prefix}${i}`;
      markStyles[at] = markStyle(mark);
      const bounds = markBounds(mark);
      if (bounds) put('marks', at, bounds);
      for (const key of ['label', 'subtitle', 'valueLabel'])
        if (mark[key] && typeof mark[key].x === 'number')
          put('labels', `${at}.${key}`, { x: mark[key].x, y: mark[key].y });
    });

    (body.annotations ?? []).forEach((annotation: Any, i: number) => {
      const at = `${prefix}${annotationKey(annotation, i)}`;
      annotationStyles[at] = annotationStyle(annotation);
      if (annotation.label) {
        put('annotations', `${at}.label`, { x: annotation.label.x, y: annotation.label.y });
        put('annotations', `${at}.visible`, annotation.label.visible ? 1 : 0);
        put('annotations', `${at}.lines`, (annotation.label.lines ?? []).join('\n'));
        const connector = annotation.label.connector;
        if (connector)
          put('annotations', `${at}.connector`, { from: connector.from, to: connector.to });
      }
      if (annotation.subtitle)
        put('annotations', `${at}.subtitle`, {
          x: annotation.subtitle.x,
          y: annotation.subtitle.y,
        });
      if (annotation.rect) put('annotations', `${at}.rect`, annotation.rect);
      if (annotation.line) put('annotations', `${at}.line`, annotation.line);
      if (annotation.dot)
        put('annotations', `${at}.dot`, { x: annotation.dot.x, y: annotation.dot.y });
    });
  }
  style.axes = axesStyles;
  style.marks = markStyles;
  style.annotations = annotationStyles;

  // Legends.
  const legendStyles: Record<string, unknown> = {};
  for (const [name, legend] of legendsOf(layout)) {
    legendStyles[name] = legendStyle(legend);
    if (legend.bounds) put('legend', `${name}.bounds`, legend.bounds);
    for (const [i, entry] of (legend.entryPositions ?? []).entries())
      put('legend', `${name}.entry.${i}`, { x: entry.x, y: entry.y });
    if (legend.bar) put('legend', `${name}.bar`, legend.bar);
  }
  style.legends = legendStyles;

  // Endpoint labels.
  const endpoint = layout.endpointLabels;
  if (endpoint) {
    const entryStyle = (entry: Any) => ({
      series: entry.seriesKey,
      label: (entry.labelLines ?? []).join(' '),
      value: entry.value,
      color: entry.color,
      marker: entry.marker
        ? {
            fill: entry.marker.fill,
            stroke: entry.marker.stroke,
            strokeWidth: entry.marker.strokeWidth,
            radius: entry.marker.radius,
          }
        : null,
    });
    style.endpointLabels = clean({
      labelStyle: textStyle(endpoint.labelStyle),
      valueStyle: textStyle(endpoint.valueStyle),
      swatchChipFill: endpoint.swatchChipFill,
      entries: (endpoint.entries ?? []).map(entryStyle),
      leading: (endpoint.leading ?? []).map(entryStyle),
    });
    put('endpointLabels', 'bounds', endpoint.bounds);
    if (endpoint.leadingBounds) put('endpointLabels', 'leadingBounds', endpoint.leadingBounds);
    (endpoint.entries ?? []).forEach((entry: Any, i: number) => {
      put('endpointLabels', `${i}.labelY`, entry.labelY);
      put('endpointLabels', `${i}.lines`, (entry.labelLines ?? []).join('\n'));
    });
  }

  // Tables: paint per cell, widths as geometry.
  if (Array.isArray(layout.columns)) {
    style.table = clean({
      density: layout.density,
      striped: layout.striped,
      columns: layout.columns.map((column: Any) => ({
        key: column.key,
        label: column.label,
        cellType: column.cellType,
        align: column.align,
      })),
      rows: (layout.rows ?? []).map((row: Any) =>
        (row.cells ?? []).map((cell: Any) => [cell.formattedValue, cell.style ?? null]),
      ),
    });
    for (const column of layout.columns) put('marks', `column.${column.key}`, column.width);
  }

  // Graphs: nodes and edges carry no positions until the force simulation runs.
  if (Array.isArray(layout.edges)) {
    style.graph = clean({
      nodes: (layout.nodes ?? []).map((node: Any) => ({
        id: node.id,
        fill: node.fill,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
        opacity: node.opacity,
        label: node.label ?? null,
      })),
      edges: layout.edges.map((edge: Any) => ({
        stroke: edge.stroke,
        strokeWidth: edge.strokeWidth,
        style: edge.style,
      })),
    });
    for (const node of layout.nodes ?? []) put('marks', `node.${node.id}.radius`, node.radius);
  }

  return { style: clean(style) as Record<string, unknown>, geometry };
}

/** Flatten a nested value into `path -> leaf` for diff reporting. */
export function flatten(value: unknown, path = '', out: Record<string, unknown> = {}) {
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value)
      ? value.map((child, i) => [String(i), child] as const)
      : Object.entries(value);
    if (!entries.length) out[path] = Array.isArray(value) ? '[]' : '{}';
    for (const [key, child] of entries) flatten(child, path ? `${path}.${key}` : key, out);
  } else out[path] = value;
  return out;
}
