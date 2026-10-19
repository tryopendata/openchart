/** Opt-in geographic text preparation. No placement, camera state or DOM reads. */
import type {
  EncodingChannel,
  GeoCalloutNoteSlot,
  GeoLabelCandidate,
  GeoTextBlock,
  MeasureTextFn,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { formatDate } from '@opendata-ai/openchart-core';
import { utcFormat } from 'd3-time-format';
import { finiteNumber } from '../data/finite-number';
import { resolveFieldFormatter } from '../format/field-format';
import { captureGeoLabelGeometries } from './label-geometry';
import { measureGeoKeyText } from './layout';
import {
  GEO_CALLOUT_CANDIDATE_LIMIT,
  GEO_TEXT_CANDIDATE_LIMIT,
  resolveGeoOverlay,
} from './overlay-layout';
import type { NormalizedGeoMapSpec } from './types';

export interface PreparedGeoLabels {
  /** Complete source inventory, including unresolved and over-cap candidates. */
  candidates: GeoLabelCandidate[];
  /** Positions are relative to the eventual start of the note band. */
  noteSlots: GeoCalloutNoteSlot[];
  noteHeight: number;
  markerRadius: number;
}

export function hasGeoLabels(spec: NormalizedGeoMapSpec): boolean {
  return !!(spec.encoding.text || spec.points?.text || spec.callouts?.length);
}

function textBlock(
  text: string,
  subtitle: string | undefined,
  width: number,
  style: TextStyle,
  measure: MeasureTextFn,
): GeoTextBlock {
  const parts = [
    { text, style },
    ...(subtitle !== undefined ? [{ text: subtitle, style: { ...style, fontWeight: 400 } }] : []),
  ];
  const lines: GeoTextBlock['lines'] = [];
  let y = 0;
  let measuredWidth = 0;
  for (const part of parts) {
    const wrapped = measureGeoKeyText(part.text, Math.max(1, width), part.style, measure);
    for (const line of wrapped.lines) {
      lines.push({ text: line, x: 0, y: y + part.style.fontSize, style: part.style });
      measuredWidth = Math.max(
        measuredWidth,
        measure(line, part.style.fontSize, part.style.fontWeight).width,
      );
      y += wrapped.advance;
    }
  }
  return { lines, width: Math.ceil(measuredWidth), height: Math.ceil(y) };
}

function fieldText(
  channel: EncodingChannel,
  rows: Record<string, unknown>[],
): (row: Record<string, unknown>) => string | undefined {
  const format =
    channel.type === 'quantitative'
      ? resolveFieldFormatter({
          channelFormat: channel.format,
          values: rows.map((row) => row[channel.field]),
        })
      : undefined;
  return (row) => {
    const value = row[channel.field];
    if (value === null || value === undefined) return undefined;
    if (channel.type === 'quantitative') {
      const number = finiteNumber(value);
      return number === undefined ? undefined : format!(number);
    }
    if (channel.type === 'temporal') {
      const date = value instanceof Date ? value : new Date(value as string | number);
      if (!Number.isFinite(date.getTime())) return undefined;
      return channel.format ? utcFormat(channel.format)(date) : formatDate(date);
    }
    const text = String(value);
    return text.trim() ? text : undefined;
  };
}
const finitePriority = (value: unknown) => finiteNumber(value) ?? 0;

/** Build all identities and measure the maximum authored note capacity before fitting. */
export function prepareGeoLabels(
  spec: NormalizedGeoMapSpec,
  features: GeoJSON.Feature[],
  joined: Map<string | number, Record<string, unknown>>,
  theme: ResolvedTheme,
  measure: MeasureTextFn,
  width: number,
): PreparedGeoLabels | undefined {
  if (!hasGeoLabels(spec)) return undefined;
  const candidates: GeoLabelCandidate[] = [];
  const noteSlots: GeoCalloutNoteSlot[] = [];
  const style: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.35,
  };
  if (spec.encoding.text) {
    // Own joined fields win, including explicit null. Only the same requested
    // property can supply unjoined feature text; topology.name is never guessed.
    const contexts = features.map((feature) => ({
      ...feature.properties,
      ...joined.get(feature.id as string | number),
    }));
    const format = fieldText(spec.encoding.text, contexts);
    for (const [index, feature] of features.entries()) {
      const text = format(contexts[index]);
      if (text === undefined) continue;
      const id = String(feature.id);
      candidates.push({
        id: `feature:${id}`,
        kind: 'text',
        anchor: { kind: 'feature', id: feature.id as string | number },
        geometryId: id,
        text,
        priority: finitePriority(
          spec.encoding.textPriority ? contexts[index][spec.encoding.textPriority.field] : 0,
        ),
        block: textBlock(text, undefined, Math.min(180, width), style, measure),
      });
    }
  }
  if (spec.points?.text) {
    const points = spec.points;
    const format = fieldText(points.text!, points.data);
    for (const row of points.data) {
      const text = format(row);
      if (text === undefined) continue;
      const id = row[points.key!.field] as string | number;
      const priority = points.textPriority ?? points.size;
      candidates.push({
        id: `point:${String(id)}`,
        kind: 'text',
        anchor: { kind: 'point', id },
        text,
        priority: finitePriority(priority ? row[priority.field] : 0),
        block: textBlock(text, undefined, Math.min(180, width), style, measure),
      });
    }
  }
  let noteY = 0;
  for (const [index, callout] of (spec.callouts ?? []).entries()) {
    const id = `callout:${callout.id}`;
    const block = textBlock(
      callout.text,
      callout.subtitle,
      Math.min(callout.maxWidth ?? 240, width),
      { ...style, fontWeight: theme.fonts.weights.medium },
      measure,
    );
    const layer = callout.anchor.layerId
      ? spec.geo.detailLayers?.find((layer) => layer.id === callout.anchor.layerId)
      : undefined;
    candidates.push({
      id,
      kind: 'callout',
      anchor: callout.anchor,
      text: callout.text,
      subtitle: callout.subtitle,
      priority: callout.priority ?? 0,
      block,
      minZoom: layer ? Math.max(layer.minZoom, callout.minZoom ?? 1) : callout.minZoom,
      maxZoom:
        layer?.maxZoom === undefined
          ? callout.maxZoom
          : Math.min(layer.maxZoom, callout.maxZoom ?? Infinity),
      offset: callout.offset,
      noteSlot: index,
      ...(callout.anchor.kind === 'feature'
        ? {
            geometryId: callout.anchor.layerId
              ? `${callout.anchor.layerId}:${String(callout.anchor.id)}`
              : String(callout.anchor.id),
          }
        : {}),
    });
    const note = textBlock(
      `${index + 1}. ${callout.text}`,
      callout.subtitle,
      width,
      style,
      measure,
    );
    noteSlots.push({
      id,
      number: index + 1,
      bounds: { x: 0, y: noteY, width: note.width, height: note.height },
      block: note,
    });
    noteY += note.height + 8;
  }
  return {
    candidates,
    noteSlots,
    noteHeight: noteSlots.length ? noteY : 0,
    markerRadius: (7 * theme.fonts.sizes.small) / 12,
  };
}

/** Bind prepared text to the single fitted projection and resolve its base view. */
export function compilePreparedGeoLabels(
  prepared: PreparedGeoLabels,
  features: GeoJSON.Feature[],
  projection: import('./label-geometry').LabelProjection | undefined,
  points: import('@opendata-ai/openchart-core').GeoMapPointMark[],
  area: import('@opendata-ai/openchart-core').Rect,
  obstacles: import('@opendata-ai/openchart-core').Rect[],
  noteY: number,
  diagnostic: (code: string, message: string, path?: string) => void,
  viewId = 'root',
  layerIds: ReadonlySet<string> = new Set(),
): import('@opendata-ai/openchart-core').GeoLabelsBundle {
  const pointById = new Map(points.map((point) => [String(point.key), point]));
  const candidates = prepared.candidates.map((candidate) => {
    if (
      (candidate.anchor.viewId && candidate.anchor.viewId !== viewId) ||
      (candidate.anchor.layerId && !layerIds.has(candidate.anchor.layerId))
    )
      return { ...candidate, geometryId: undefined, resolvedAnchor: undefined };
    if (candidate.anchor.kind === 'point') {
      const point = pointById.get(String(candidate.anchor.id));
      return {
        ...candidate,
        ...(point ? { resolvedAnchor: { x: point.cx, y: point.cy }, anchorRadius: point.r } : {}),
      };
    }
    if (candidate.anchor.kind === 'coordinate' && projection) {
      const projected = projection([candidate.anchor.x, candidate.anchor.y]);
      return {
        ...candidate,
        ...(projected?.every(Number.isFinite)
          ? { resolvedAnchor: { x: projected[0], y: projected[1] } }
          : {}),
      };
    }
    return candidate;
  });
  const ordered = [...candidates].sort(
    (a, b) =>
      (a.kind === 'callout' ? 0 : 1) - (b.kind === 'callout' ? 0 : 1) ||
      b.priority - a.priority ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let texts = 0;
  let callouts = 0;
  const selected = ordered.filter((candidate) =>
    candidate.kind === 'callout'
      ? ++callouts <= GEO_CALLOUT_CANDIDATE_LIMIT
      : ++texts <= GEO_TEXT_CANDIDATE_LIMIT,
  );
  const wanted = new Set(
    selected
      .map((candidate) => candidate.geometryId)
      .filter((id): id is string => id !== undefined),
  );
  const byId = new Map(features.map((feature) => [String(feature.id), feature]));
  const requests = [...wanted].flatMap((featureId) => {
    const feature = byId.get(featureId);
    return feature ? [{ featureId, feature }] : [];
  });
  const geometries = projection
    ? captureGeoLabelGeometries(requests, projection, {
        onDiagnostic: (message) => diagnostic('MAP_LABEL_GEOMETRY_BUDGET', message),
      })
    : [];
  const input: import('@opendata-ai/openchart-core').GeoLabelsInput = {
    candidates,
    geometries,
    markerRadius: prepared.markerRadius,
    ...(points.length
      ? {
          symbolObstacles: points.map((point) => ({
            center: { x: point.cx, y: point.cy },
            radius: point.r,
          })),
        }
      : {}),
    viewport: { x: 0, y: 0, width: Math.max(0, area.width), height: Math.max(0, area.height) },
    obstacles: obstacles.map((rect) => ({ ...rect, x: rect.x - area.x, y: rect.y - area.y })),
    noteSlots: prepared.noteSlots.map((slot) => ({
      ...slot,
      bounds: { ...slot.bounds, y: slot.bounds.y + noteY },
    })),
  };
  const initialOverlay = resolveGeoOverlay(input, { k: 1, tx: 0, ty: 0 });
  if (texts > GEO_TEXT_CANDIDATE_LIMIT || callouts > GEO_CALLOUT_CANDIDATE_LIMIT)
    diagnostic(
      'MAP_LABEL_CANDIDATE_BUDGET',
      'Visual label candidates exceed the placement budget; every candidate remains in the accessible inventory and callouts retain their note slots.',
    );
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  for (const entry of initialOverlay.inventory) {
    if (entry.visibility !== 'unresolved') continue;
    const candidate = candidatesById.get(entry.id)!;
    const path =
      candidate.kind === 'callout'
        ? `/callouts/${candidate.noteSlot}/anchor`
        : candidate.anchor.kind === 'point'
          ? '/points/text'
          : '/encoding/text';
    diagnostic(
      'MAP_LABEL_UNRESOLVED',
      `Map label ${entry.id} has no usable anchor; its complete text is retained in the inventory${entry.kind === 'callout' ? ' and note band' : ''}.`,
      path,
    );
  }
  return { ...input, initialOverlay };
}
