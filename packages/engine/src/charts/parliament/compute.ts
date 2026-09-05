/**
 * Parliament (hemicycle) chart mark computation.
 *
 * Seat dots packed into concentric semicircular arcs, party-grouped left to
 * right, with a majority-threshold line. Election/legislature results are a
 * part-to-whole count (seats per party) that the standard bar/pie machinery
 * can't lay out, so this module owns the seat-packing geometry.
 *
 * Emits existing mark types (no bespoke layout): one `PointMark` per seat,
 * one `RuleMarkLayout` for the majority line, and one `TextMarkLayout` for the
 * "N to win" label. Riding the existing chart pipeline gets scales, legend,
 * tooltips, a11y, dark mode, and animation for free (parliament is axisless,
 * so `isAxislessMark` skips axes/gridlines just like arc and waffle).
 *
 * Seat layout algorithm (deterministic, published approach): pick the smallest
 * number of concentric rows R such that N seats fit given a minimum seat-to-row
 * gap ratio, distribute seats across rows proportional to each row's arc
 * length (outer rows hold more), place each row's seats at even angles across
 * the top semicircle (180deg on the left to 0deg on the right), then sort all
 * seats left-to-right and assign parties to consecutive blocks in data order.
 */

import type {
  DataRow,
  Encoding,
  LayoutStrategy,
  Mark,
  MarkAria,
  PointMark,
  Rect,
  ResolvedTheme,
  RuleMarkLayout,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { formatPercent } from '@opendata-ai/openchart-core';

import { serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, stackSeamStroke } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fraction of the seat pitch used as the gap between adjacent seat dots. */
const SEAT_GAP_FRACTION = 0.4;

/** Inner-radius fraction of the outer radius (the hollow center of the arc). */
const INNER_RADIUS_FRACTION = 0.4;

/** Maximum number of concentric rows we will pack into. */
const MAX_ROWS = 40;

// ---------------------------------------------------------------------------
// Seat-packing geometry
// ---------------------------------------------------------------------------

/** A single packed seat position (before party assignment). */
interface SeatSlot {
  /** Angle in radians measured across the top semicircle (PI = left, 0 = right). */
  angle: number;
  /** Radius from the hemicycle center. */
  radius: number;
  /** Row index (0 = innermost). */
  row: number;
}

/**
 * Choose the number of concentric rows for `seats` seats.
 *
 * More seats need more rows to stay legible. We grow the row count until the
 * seats-per-innermost-row stays under a density cap derived from the ring
 * geometry, capped at MAX_ROWS. Deterministic: same seat count always yields
 * the same row count.
 */
function chooseRowCount(seats: number): number {
  if (seats <= 0) return 0;
  // The classic hemicycle heuristic: rows grow ~ with sqrt of seat count so
  // dot size stays roughly constant as the assembly grows.
  const rows = Math.max(1, Math.round(Math.sqrt(seats / 3)));
  return Math.min(MAX_ROWS, rows);
}

/**
 * Pack `seats` seat slots into `rows` concentric semicircular rows.
 *
 * Seats are distributed across rows proportional to each row's radius (arc
 * length), then placed at even angular steps across the top semicircle. The
 * returned slots are sorted left-to-right (descending angle) so party blocks
 * assign to contiguous seats.
 */
function packSeats(seats: number, rows: number): SeatSlot[] {
  if (seats <= 0 || rows <= 0) return [];

  // Row radii are evenly spaced from inner to outer in normalized [0,1] units.
  // With a single row, place it midway between inner and outer.
  const rowRadii: number[] = [];
  for (let i = 0; i < rows; i++) {
    const t = rows === 1 ? 0.5 : i / (rows - 1);
    rowRadii.push(INNER_RADIUS_FRACTION + t * (1 - INNER_RADIUS_FRACTION));
  }

  // Distribute seats across rows proportional to radius (arc length), using
  // largest-remainder so the counts sum exactly to `seats`.
  const radiusSum = rowRadii.reduce((s, r) => s + r, 0);
  const rawCounts = rowRadii.map((r) => (r / radiusSum) * seats);
  const rowCounts = rawCounts.map((c) => Math.floor(c));
  let allocated = rowCounts.reduce((s, c) => s + c, 0);
  const remainders = rawCounts
    .map((c, i) => ({ rem: c - Math.floor(c), i }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; allocated < seats; k++, allocated++) {
    rowCounts[remainders[k % remainders.length].i] += 1;
  }

  const slots: SeatSlot[] = [];
  for (let row = 0; row < rows; row++) {
    const count = rowCounts[row];
    if (count <= 0) continue;
    const radius = rowRadii[row];
    // Place seats at even angular steps from PI (left) to 0 (right). A single
    // seat in a row sits at the top (PI/2).
    for (let s = 0; s < count; s++) {
      const t = count === 1 ? 0.5 : s / (count - 1);
      const angle = Math.PI - t * Math.PI;
      slots.push({ angle, radius, row });
    }
  }

  // Sort left-to-right: descending angle (PI first), ties broken outer-row
  // first so blocks read cleanly top-to-bottom within a column.
  slots.sort((a, b) => b.angle - a.angle || b.radius - a.radius);
  return slots;
}

// ---------------------------------------------------------------------------
// Majority computation
// ---------------------------------------------------------------------------

/** Knockout ring width around each seat, in pixels. */
const SEAT_STROKE_WIDTH = 0.75;

/** Resolve the majority-line seat threshold and label from the mark options. */
function resolveMajority(
  totalSeats: number,
  majorityLine: boolean | { seats?: number; label?: string } | undefined,
): { seats: number; label: string } | null {
  if (majorityLine === false) return null;
  const defaultSeats = Math.floor(totalSeats / 2) + 1;
  if (majorityLine == null || majorityLine === true) {
    return { seats: defaultSeats, label: `${defaultSeats} to win` };
  }
  // An explicit `seats` must land inside the chamber (1..totalSeats). `{ seats: 0 }`
  // or a negative/oversized value would draw the majority marker off the seat
  // arc where it reads as nothing, so fall back to the default. The user-facing
  // warning for this fires once from normalize (warnParliamentMajorityRange),
  // which owns the shared warnings channel; this clamp is the defensive backstop
  // for direct compute calls.
  let seats = majorityLine.seats ?? defaultSeats;
  if (!Number.isFinite(seats) || seats < 1 || seats > totalSeats) {
    seats = defaultSeats;
  }
  return { seats, label: majorityLine.label ?? `${seats} to win` };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute parliament (hemicycle) marks from a normalized chart spec.
 *
 * Categories (parties) come from the color field in data order (matching pie
 * and the legend); the seat count from the quantitative y channel (theta
 * pre-aliased to y). Emits seat PointMarks in left-to-right order (driving the
 * entrance-stagger sweep), then the majority RuleMark and its label TextMark.
 */
export function computeParliamentMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  _strategy: LayoutStrategy,
  theme: ResolvedTheme,
): Mark[] {
  const encoding = spec.encoding as Encoding;

  const valueChannel = encoding.y ?? encoding.x;
  const colorField = encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;
  if (!valueChannel || !colorField) return [];

  // Aggregate seats by party, preserving data order (drives seat order, color
  // assignment, and the legend, which derives the same order from data).
  const partyTotals = new Map<string, number>();
  const partyRows = new Map<string, DataRow>();
  for (const row of spec.data) {
    const party = String(row[colorField] ?? '');
    const val = Number(row[valueChannel.field] ?? 0);
    if (!Number.isFinite(val) || val < 0) continue;
    partyTotals.set(party, (partyTotals.get(party) ?? 0) + Math.round(val));
    if (!partyRows.has(party)) partyRows.set(party, row);
  }

  const parties = [...partyTotals.keys()];
  const totalSeats = parties.reduce((s, p) => s + (partyTotals.get(p) ?? 0), 0);
  if (parties.length === 0 || totalSeats <= 0) return [];

  const rows = chooseRowCount(totalSeats);
  const slots = packSeats(totalSeats, rows);
  if (slots.length === 0) return [];

  // Geometry: fit the hemicycle (a half-disc, so width = 2*R, height = R plus
  // one seat radius of headroom) into the chart area and center it.
  const seatRadiusOpt = spec.markDef.seatRadius;

  // Angular seat pitch from the densest (innermost) occupied row bounds the dot
  // size so seats in the tightest row don't overlap.
  const outerRadius = Math.min(chartArea.width / 2, chartArea.height);
  const innerR = outerRadius * INNER_RADIUS_FRACTION;
  // Seats per innermost row ~ slots on the smallest radius. Derive a max dot
  // radius from the innermost row's arc-length per seat.
  const innerRowCount = slots.filter((s) => s.row === 0).length || 1;
  const innerArcPerSeat = (Math.PI * innerR) / Math.max(1, innerRowCount);
  const ringGap = rows > 1 ? (outerRadius - innerR) / (rows - 1) : outerRadius - innerR;
  const autoSeatRadius = (Math.min(innerArcPerSeat, ringGap) / 2) * (1 - SEAT_GAP_FRACTION);
  const seatRadius =
    typeof seatRadiusOpt === 'number' && seatRadiusOpt > 0
      ? seatRadiusOpt
      : Math.max(1.5, autoSeatRadius);

  const centerX = chartArea.x + chartArea.width / 2;
  // Anchor the flat base near the bottom of the area, leaving a seat radius of
  // headroom below so the bottom row's dots aren't clipped.
  const centerY = chartArea.y + chartArea.height - seatRadius;

  // Assign parties to contiguous seat blocks in data order.
  const knockout = stackSeamStroke(theme);
  const marks: Mark[] = [];
  let slotIndex = 0;
  let animationIndex = 0;
  for (const party of parties) {
    const count = partyTotals.get(party) ?? 0;
    if (count <= 0) continue;
    const row = partyRows.get(party)!;
    const shareStr = totalSeats > 0 ? formatPercent(count / totalSeats) : '0%';
    const fill = getColor(scales, party);
    const partyKey = serializeKeyValue(party);

    for (let k = 0; k < count && slotIndex < slots.length; k++, slotIndex++, animationIndex++) {
      const slot = slots[slotIndex];
      // slot.radius is normalized [INNER_RADIUS_FRACTION, 1]; scale to pixels.
      const pixelRadius = slot.radius * outerRadius;
      const cx = centerX + Math.cos(slot.angle) * pixelRadius;
      const cy = centerY - Math.sin(slot.angle) * pixelRadius;

      // One SR stop per party: the first seat carries the label, the rest are
      // decorative duplicates (435 seats would drown screen reader users).
      const aria: MarkAria =
        k === 0
          ? { label: `${party}: ${count} seats (${shareStr})` }
          : { label: `${party} seat`, decorative: true };

      const seat: PointMark = {
        type: 'point',
        key: `${partyKey}|${k}`,
        cx,
        cy,
        r: seatRadius,
        fill,
        // Knockout ring: seats are packed tight enough that same-party
        // neighbours merge into a blob without a hairline of canvas between.
        stroke: knockout,
        strokeWidth: SEAT_STROKE_WIDTH,
        data: row as Record<string, unknown>,
        aria,
        animationIndex,
      };
      marks.push(seat);
    }
  }

  // Majority-threshold line + label.
  const majority = resolveMajority(totalSeats, spec.markDef.majorityLine);
  if (majority && majority.seats > 0 && majority.seats <= totalSeats) {
    const lineTop = centerY - outerRadius - seatRadius;
    const line: RuleMarkLayout = {
      type: 'rule',
      key: 'oc-majority-line',
      x1: centerX,
      y1: lineTop,
      x2: centerX,
      y2: centerY + seatRadius,
      stroke: theme.colors.text,
      strokeWidth: 1.5,
      strokeDasharray: '4 3',
      opacity: 0.7,
      data: { majority: majority.seats } as Record<string, unknown>,
      aria: { label: `Majority threshold: ${majority.seats} seats`, decorative: true },
    };
    marks.push(line);

    const label: TextMarkLayout = {
      type: 'textMark',
      key: 'oc-majority-label',
      x: centerX,
      y: Math.max(chartArea.y + theme.fonts.sizes.small, lineTop - 6),
      text: majority.label,
      fill: theme.colors.axis,
      fontSize: theme.fonts.sizes.small,
      fontWeight: theme.fonts.weights.semibold,
      textAnchor: 'middle',
      data: { majority: majority.seats } as Record<string, unknown>,
      aria: { label: `${majority.seats} seats needed for a majority`, decorative: true },
    };
    marks.push(label);
  }

  return marks;
}
