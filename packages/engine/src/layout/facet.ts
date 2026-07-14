import type { Rect } from '@opendata-ai/openchart-core';

const MIN_PANEL_WIDTH = 200;
export const MIN_PANEL_HEIGHT = 100;
const PANEL_GAP = 12;
const HEADER_HEIGHT = 20;
const X_AXIS_HEIGHT = 24;

export interface FacetGridPanel {
  key: string;
  area: Rect;
  headerPos: { x: number; y: number };
  row: number;
  col: number;
}

export interface FacetGridResult {
  panels: FacetGridPanel[];
  columns: number;
  rows: number;
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
): FacetGridResult {
  const n = facetValues.length;
  if (n === 0) return { panels: [], columns: 0, rows: 0 };

  const usableWidth = totalArea.width - outerAxisReservation.left;
  let columns = Math.min(requestedColumns ?? autoColumns(n, usableWidth), n);

  // Responsive degradation: reduce columns until panels are wide enough
  while (columns > 1) {
    const panelWidth = (usableWidth - (columns - 1) * PANEL_GAP) / columns;
    if (panelWidth >= MIN_PANEL_WIDTH) break;
    columns--;
  }

  const rows = Math.ceil(n / columns);
  const panelWidth = Math.max(0, (usableWidth - (columns - 1) * PANEL_GAP) / columns);
  // Every row includes its own x-axis labels, so the bottom reservation
  // applies per-row (as overhead), not just at the grid bottom.
  const xAxisPerRow = outerAxisReservation.bottom;
  const usableHeight = totalArea.height;
  const panelHeight = Math.max(
    0,
    (usableHeight - rows * (HEADER_HEIGHT + xAxisPerRow) - (rows - 1) * PANEL_GAP) / rows,
  );

  const rowStride = HEADER_HEIGHT + panelHeight + xAxisPerRow + PANEL_GAP;
  const panels: FacetGridPanel[] = [];

  for (let i = 0; i < n; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = totalArea.x + outerAxisReservation.left + col * (panelWidth + PANEL_GAP);
    const y = totalArea.y + row * rowStride;

    panels.push({
      key: facetValues[i],
      area: {
        x,
        y: y + HEADER_HEIGHT,
        width: panelWidth,
        height: panelHeight,
      },
      headerPos: {
        x: x + panelWidth / 2,
        y: y + HEADER_HEIGHT * 0.6,
      },
      row,
      col,
    });
  }

  return { panels, columns, rows };
}
