import type { Rect } from '@opendata-ai/openchart-core';
import {
  admitReferenceRows,
  packReferenceRows,
  type ReferenceReserve,
  referenceLaneHeights,
} from '../annotations/reference-layout';
import type { BarLabelPlan } from '../charts/bar/label-plan';
import type { AxisTitleHeader } from './axis-title-plan';
import { fitReferenceLane, REFERENCE_LANE_SHARE_MAX } from './stack';

const MIN_PANEL_WIDTH = 200;
export const MIN_PANEL_HEIGHT = 100;
const PANEL_GAP = 12;
const HEADER_HEIGHT = 20;
const X_AXIS_HEIGHT = 24;

export interface FacetGridPanel {
  key: string;
  area: Rect;
  headerPos: { x: number; y: number };
  referenceContainer?: Rect;
  /** This panel's outside-label reserve, with top-lane rows admitted under the lane cap. */
  referenceReserve?: ReferenceReserve;
  row: number;
  col: number;
}

export interface FacetGridResult {
  panels: FacetGridPanel[];
  columns: number;
  rows: number;
  minimumHeight?: number;
  valueLabelPlan?: BarLabelPlan;
  axisTitleHeader?: AxisTitleHeader;
}

export function autoColumns(panelCount: number, availableWidth: number): number {
  const sqrtCols = Math.ceil(Math.sqrt(panelCount));
  const fitCols = Math.max(1, Math.floor(availableWidth / MIN_PANEL_WIDTH));
  return Math.min(sqrtCols, fitCols, panelCount);
}

export function facetMinHeight(panelCount: number, columns: number): number {
  const rows = Math.ceil(panelCount / columns);
  return rows * (MIN_PANEL_HEIGHT + HEADER_HEIGHT + X_AXIS_HEIGHT) + (rows - 1) * PANEL_GAP;
}

export function computeFacetGrid(
  facetValues: string[],
  requestedColumns: number | undefined,
  totalArea: Rect,
  outerAxisReservation: { left: number; bottom: number },
  referenceInsets?: {
    measure: (width: number) => ReferenceReserve;
    innerAxisWidth: number;
  },
  valueInsets?: {
    measure: (width: number, height?: number) => BarLabelPlan;
    innerAxisWidth: number;
  },
  measureAxisHeader?: (width: number) => AxisTitleHeader | undefined,
): FacetGridResult {
  const n = facetValues.length;
  if (n === 0) return { panels: [], columns: 0, rows: 0 };

  const usableWidth = totalArea.width - outerAxisReservation.left;
  let columns = Math.min(requestedColumns ?? autoColumns(n, usableWidth), n);

  // Responsive degradation: reduce columns until panels are wide enough
  while (columns > 1) {
    const panelWidth = (usableWidth - (columns - 1) * PANEL_GAP) / columns;
    const innerAxis = Math.max(
      referenceInsets?.innerAxisWidth ?? 0,
      valueInsets?.innerAxisWidth ?? 0,
    );
    const right = referenceInsets?.measure(panelWidth - innerAxis).right ?? 0;
    const labels = valueInsets?.measure(panelWidth - innerAxis - right);
    if (
      panelWidth - innerAxis - right - (labels?.reserveLeft ?? 0) - (labels?.reserveRight ?? 0) >=
      MIN_PANEL_WIDTH
    )
      break;
    columns--;
  }

  const rows = Math.ceil(n / columns);
  const panelWidth = Math.max(0, (usableWidth - (columns - 1) * PANEL_GAP) / columns);
  // Every row includes its own x-axis labels, so the bottom reservation
  // applies per-row (as overhead), not just at the grid bottom.
  const xAxisPerRow = outerAxisReservation.bottom;
  const usableHeight = totalArea.height;
  // The top lane is capped per grid row exactly as the single-chart lane is
  // capped per figure (fitReferenceLane): leading rows are admitted whole while
  // they fit the lane's share of the row height and leave the panel its
  // minimum. Short grids grow to their minimum height (compileFaceted), so the
  // row is measured at the height it will grow to: never less than the panel
  // minimum plus the rows that fit the share at that minimum. Every panel in a
  // grid row shares the lane, sized for the narrowest panel.
  let topInset = 0;
  if (referenceInsets) {
    const narrowest = referenceInsets.measure(
      panelWidth - (columns > 1 ? referenceInsets.innerAxisWidth : 0),
    );
    const cumulative = referenceLaneHeights(packReferenceRows(narrowest.labels));
    const minRow = HEADER_HEIGHT + MIN_PANEL_HEIGHT + xAxisPerRow;
    const minLane = cumulative.filter((c) => c <= REFERENCE_LANE_SHARE_MAX * (minRow + c)).at(-1);
    const rowHeight = (usableHeight - (rows - 1) * PANEL_GAP) / rows;
    // At or below the grown height (which a grown grid lands on up to float
    // error), the lane is exactly the rows that fit there.
    topInset =
      rowHeight <= minRow + (minLane ?? 0) + 1e-6
        ? (minLane ?? 0)
        : fitReferenceLane(
            cumulative,
            rowHeight,
            rowHeight - HEADER_HEIGHT - xAxisPerRow,
            MIN_PANEL_HEIGHT,
          ).reserve;
  }
  const rawPanelHeight = Math.max(
    0,
    (usableHeight - rows * (HEADER_HEIGHT + topInset + xAxisPerRow) - (rows - 1) * PANEL_GAP) /
      rows,
  );

  const innerAxisWidth = Math.max(
    referenceInsets?.innerAxisWidth ?? 0,
    valueInsets?.innerAxisWidth ?? 0,
  );
  const narrowestWidth = panelWidth - (columns > 1 ? innerAxisWidth : 0);
  const referenceRight = referenceInsets?.measure(narrowestWidth).right ?? 0;
  // One figure-level measurement and mode decision applies to every panel.
  const valueLabelPlan = valueInsets?.measure(narrowestWidth - referenceRight, rawPanelHeight);
  const axisTitleHeader = measureAxisHeader?.(
    narrowestWidth -
      referenceRight -
      (valueLabelPlan?.reserveLeft ?? 0) -
      (valueLabelPlan?.reserveRight ?? 0),
  );
  const valueTop = (valueLabelPlan?.reserveTop ?? 0) + (axisTitleHeader?.height ?? 0);
  const valueBottom = valueLabelPlan?.reserveBottom ?? 0;
  const valueLeft = valueLabelPlan?.reserveLeft ?? 0;
  const valueRight = valueLabelPlan?.reserveRight ?? 0;
  const panelHeight = Math.max(0, rawPanelHeight - valueTop - valueBottom);
  const rowStride =
    HEADER_HEIGHT + topInset + valueTop + panelHeight + valueBottom + xAxisPerRow + PANEL_GAP;
  const panels: FacetGridPanel[] = [];

  for (let i = 0; i < n; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = totalArea.x + outerAxisReservation.left + col * (panelWidth + PANEL_GAP);
    const y = totalArea.y + row * rowStride;

    const leftInset = col > 0 ? innerAxisWidth : 0;
    const measured = referenceInsets?.measure(panelWidth - leftInset);
    const reserve =
      measured && admitReferenceRows(measured, packReferenceRows(measured.labels), topInset);
    const areaY = y + HEADER_HEIGHT + topInset + valueTop;
    panels.push({
      key: facetValues[i],
      area: {
        x: x + leftInset + valueLeft,
        y: areaY,
        width: Math.max(0, panelWidth - leftInset - (reserve?.right ?? 0) - valueLeft - valueRight),
        height: panelHeight,
      },
      ...(referenceInsets
        ? {
            referenceContainer: {
              x: x + leftInset,
              // Measured back from the plot as placement measures a lane row
              // (plot top - row offset), so a full lane is not lost to float error.
              y: areaY - topInset,
              width: panelWidth - leftInset,
              height: topInset + panelHeight,
            },
            referenceReserve: reserve,
          }
        : {}),
      headerPos: {
        x: x + panelWidth / 2,
        y: y + HEADER_HEIGHT * 0.6,
      },
      row,
      col,
    });
  }

  return {
    panels,
    columns,
    rows,
    ...(valueLabelPlan ? { valueLabelPlan } : {}),
    ...(axisTitleHeader ? { axisTitleHeader } : {}),
    ...(referenceInsets || valueInsets || axisTitleHeader
      ? {
          minimumHeight:
            rows *
              (MIN_PANEL_HEIGHT + HEADER_HEIGHT + topInset + valueTop + valueBottom + xAxisPerRow) +
            (rows - 1) * PANEL_GAP,
        }
      : {}),
  };
}
