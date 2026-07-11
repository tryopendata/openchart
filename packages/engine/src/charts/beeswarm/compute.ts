/**
 * Beeswarm chart mark computation.
 *
 * One quantitative value axis positions every observation; the deterministic
 * dodge layout (see ./dodge) spreads colliding dots along the cross axis so
 * each dot stays visible. An optional nominal channel on the other axis
 * groups the dots into lanes (one swarm per category via a band scale).
 * The cross axis has no scale: offsets are pure pixel-space.
 *
 * Orientation follows the bar convention: quantitative x = horizontal swarm,
 * quantitative y = vertical swarm.
 */

import type {
  Encoding,
  GradientDef,
  LayoutStrategy,
  MarkAria,
  PointMark,
  Rect,
} from '@opendata-ai/openchart-core';
import { max, min } from 'd3-array';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import { scaleSqrt } from 'd3-scale';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, getSequentialColor } from '../utils';
import { dodgeOffsets } from './dodge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default dot radius (px). Smaller than the scatter default (5) because
 * beeswarms carry hundreds of dots and the dodge layout trades radius for
 * swarm height: at r=4 a 300-dot swarm stays inside a typical chart area.
 */
const DEFAULT_DOT_RADIUS = 4;

/** Sized-dot radius bounds (px). Tighter than scatter's 3-30: large radii
 * make the dodge layout stack dots far past the lane, so the default cap
 * stays low. Authors override via `encoding.size.scale.range`. */
const MIN_SIZED_RADIUS = 2;
const MAX_SIZED_RADIUS = 10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute beeswarm marks from a normalized chart spec.
 *
 * The quantitative channel is the value axis (x = horizontal swarm,
 * y = vertical). The opposite channel, when present, must be nominal/ordinal
 * and lanes the dots via its band scale; otherwise all dots share one lane
 * centered on the cross axis. Radii come from the optional `size` encoding
 * (sqrt scale, area-proportional) or the default dot radius; the dodge
 * layout consumes per-dot radii so sized swarms stay collision-free.
 */
export function computeBeeswarmMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  _strategy: LayoutStrategy,
): PointMark[] {
  const encoding = spec.encoding as Encoding;

  // Orientation: prefer a quantitative x (horizontal swarm), else quantitative y.
  const isHorizontal = encoding.x?.type === 'quantitative';
  const valueChannel = isHorizontal ? encoding.x : encoding.y;
  const laneChannel = isHorizontal ? encoding.y : encoding.x;
  const valueScale = isHorizontal ? scales.x : scales.y;
  const laneScale = isHorizontal ? scales.y : scales.x;

  if (!valueChannel || valueChannel.type !== 'quantitative' || !valueScale) {
    return [];
  }

  const positionScale = valueScale.scale as ScaleLinear<number, number>;

  // Lane centers: band scale when the nominal channel is present, else the
  // middle of the cross axis. The cross axis itself has no scale: dodge
  // offsets are pixel-space around each lane center.
  const bandScale =
    laneScale && laneScale.type === 'band' ? (laneScale.scale as ScaleBand<string>) : undefined;
  const defaultLaneCenter = isHorizontal
    ? chartArea.y + chartArea.height / 2
    : chartArea.x + chartArea.width / 2;

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const isSequentialColor = colorEnc?.type === 'quantitative';
  const colorField = colorEnc?.field;
  const sizeEnc = encoding.size && 'field' in encoding.size ? encoding.size : undefined;
  const sizeField = sizeEnc?.field;

  // Size scale for sized dots: sqrt (area-proportional), same override
  // surface as scatter (`encoding.size.scale.{domain,range}`).
  let sizeScale: ((v: number) => number) | undefined;
  if (sizeField) {
    const sizeValues = spec.data.map((d) => Number(d[sizeField])).filter((v) => Number.isFinite(v));

    const explicitDomain = sizeEnc?.scale?.domain as [number, number] | undefined;
    const [sizeMin, sizeMax] = explicitDomain ?? [min(sizeValues) ?? 0, max(sizeValues) ?? 1];

    const explicitRange = sizeEnc?.scale?.range as [number, number] | undefined;
    const [radiusMin, radiusMax] = explicitRange ?? [MIN_SIZED_RADIUS, MAX_SIZED_RADIUS];

    sizeScale = scaleSqrt().domain([sizeMin, sizeMax]).range([radiusMin, radiusMax]).clamp(true);
  }

  // Resolve every renderable dot first: dodge needs the full position/radius
  // arrays before any mark can be placed.
  interface ResolvedDot {
    row: Record<string, unknown>;
    value: number;
    position: number;
    radius: number;
    lane: string;
    laneCenter: number;
  }
  const dots: ResolvedDot[] = [];

  for (const row of spec.data) {
    const raw = row[valueChannel.field];
    // Drop null/undefined explicitly: the validator tolerates them (it only
    // rejects non-numeric or non-finite present values), but Number(null) is 0,
    // which would silently place a phantom dot at value 0 instead of skipping.
    if (raw == null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    const position = positionScale(value);
    if (!Number.isFinite(position)) continue;

    let lane = '__default__';
    let laneCenter = defaultLaneCenter;
    if (bandScale && laneChannel) {
      lane = String(row[laneChannel.field] ?? '');
      const bandStart = bandScale(lane);
      if (bandStart === undefined) continue;
      laneCenter = bandStart + bandScale.bandwidth() / 2;
    }

    let radius = DEFAULT_DOT_RADIUS;
    if (sizeScale && sizeField) {
      const sizeVal = Number(row[sizeField]);
      if (Number.isFinite(sizeVal)) {
        radius = sizeScale(sizeVal);
      }
    }

    dots.push({ row: row as Record<string, unknown>, value, position, radius, lane, laneCenter });
  }

  const offsets = dodgeOffsets(
    dots.map((d) => d.position),
    dots.map((d) => d.radius),
    dots.map((d) => d.lane),
  );

  const keyEnc = encoding.key && 'field' in encoding.key ? encoding.key : undefined;
  const keyField = keyEnc?.field;
  const marks: PointMark[] = [];

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    const cross = dot.laneCenter + offsets[i];

    let color: string | GradientDef;
    if (isSequentialColor && colorField) {
      const colorVal = Number(dot.row[colorField]);
      color = Number.isFinite(colorVal)
        ? getSequentialColor(scales, colorVal)
        : getColor(scales, '__default__');
    } else if (colorField) {
      color = getColor(scales, String(dot.row[colorField] ?? '__default__'));
    } else {
      color = getColor(scales, '__default__');
    }

    const labelParts = [`${valueChannel.field}=${dot.row[valueChannel.field]}`];
    if (laneChannel && dot.lane !== '__default__') {
      labelParts.push(`${laneChannel.field}=${dot.lane}`);
    }
    if (sizeField && dot.row[sizeField] != null) {
      labelParts.push(`${sizeField}=${dot.row[sizeField]}`);
    }

    const aria: MarkAria = {
      label: `Data point: ${labelParts.join(', ')}`,
    };

    marks.push({
      type: 'point',
      cx: isHorizontal ? dot.position : cross,
      cy: isHorizontal ? cross : dot.position,
      r: dot.radius,
      fill: color,
      stroke: '#ffffff',
      strokeWidth: 1,
      data: dot.row,
      aria,
    });
  }

  // Stamp keys: encoding.key field when set, else lane|value composite
  const rawKeys = marks.map((m, i) => {
    if (keyField) return serializeKeyValue(m.data[keyField]);
    const valueKey = serializeKeyValue(m.data[valueChannel.field]);
    return dots[i].lane !== '__default__' ? `${dots[i].lane}|${valueKey}` : valueKey;
  });
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }

  return marks;
}
