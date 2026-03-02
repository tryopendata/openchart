/**
 * Table cell renderers: produce DOM elements for each cell type.
 *
 * Each renderer takes a resolved TableCell and returns an HTMLElement
 * (typically a <td>) with appropriate content, styling, and classes.
 */

import type {
  BarTableCell,
  CategoryTableCell,
  FlagTableCell,
  HeatmapTableCell,
  ImageTableCell,
  SparklineData,
  SparklineTableCell,
  TableCell,
  TextTableCell,
} from '@opendata-ai/core';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Apply common cell styles (background, color, font weight, font variant). */
function applyCellStyle(td: HTMLTableCellElement, cell: TableCell): void {
  if (cell.style.backgroundColor) {
    td.style.background = cell.style.backgroundColor;
  }
  if (cell.style.color) {
    td.style.color = cell.style.color;
  }
  if (cell.style.fontWeight) {
    td.style.fontWeight = String(cell.style.fontWeight);
  }
  if (cell.style.fontVariant) {
    td.style.fontVariant = cell.style.fontVariant;
  }
  if (cell.aria) {
    td.setAttribute('aria-label', cell.aria);
  }
}

/**
 * Convert a 2-char ISO 3166-1 alpha-2 country code to a flag emoji.
 * Each letter maps to a Regional Indicator Symbol (offset 0x1F1A5 from ASCII).
 */
function countryToEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 0x1f1a5))
    .join('');
}

/**
 * Lookup map for common country names by ISO 3166-1 alpha-2 code.
 * Falls back to the raw code for unrecognized values.
 */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CN: 'China',
  IN: 'India',
  ID: 'Indonesia',
  BR: 'Brazil',
  PK: 'Pakistan',
  NG: 'Nigeria',
  BD: 'Bangladesh',
  RU: 'Russia',
  MX: 'Mexico',
  JP: 'Japan',
  DE: 'Germany',
  GB: 'United Kingdom',
  FR: 'France',
  IT: 'Italy',
  CA: 'Canada',
  AU: 'Australia',
  KR: 'South Korea',
  ES: 'Spain',
  AR: 'Argentina',
  CO: 'Colombia',
  ZA: 'South Africa',
  TR: 'Turkey',
  SA: 'Saudi Arabia',
  UA: 'Ukraine',
  PL: 'Poland',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  CH: 'Switzerland',
  AT: 'Austria',
  BE: 'Belgium',
  PT: 'Portugal',
  IE: 'Ireland',
  NZ: 'New Zealand',
  SG: 'Singapore',
  IL: 'Israel',
  AE: 'United Arab Emirates',
  EG: 'Egypt',
  TH: 'Thailand',
  VN: 'Vietnam',
  PH: 'Philippines',
  MY: 'Malaysia',
  CL: 'Chile',
  PE: 'Peru',
  CZ: 'Czech Republic',
  GR: 'Greece',
  HU: 'Hungary',
  RO: 'Romania',
  ET: 'Ethiopia',
};

/** Get a human-readable name for a country code. */
function getCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase();
}

/**
 * Describe a sparkline trend for screen readers.
 * Compares first and last values to determine direction.
 */
function describeSparklineTrend(data: SparklineData): string {
  if (data.type === 'line' && data.points.length >= 2) {
    const first = data.points[0].y;
    const last = data.points[data.points.length - 1].y;
    const count = data.points.length;
    if (last > first) return `Sparkline with ${count} points, trending upward`;
    if (last < first) return `Sparkline with ${count} points, trending downward`;
    return `Sparkline with ${count} points, roughly flat`;
  }
  if ((data.type === 'bar' || data.type === 'column') && data.bars.length > 0) {
    return `${data.type === 'column' ? 'Column' : 'Bar'} sparkline with ${data.bars.length} values`;
  }
  return 'Sparkline';
}

// ---------------------------------------------------------------------------
// Cell renderers
// ---------------------------------------------------------------------------

/** Render a plain text cell. */
export function renderTextCell(cell: TextTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = cell.formattedValue;
  applyCellStyle(td, cell);
  return td;
}

/** Render a heatmap-colored cell. */
export function renderHeatmapCell(cell: HeatmapTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = cell.formattedValue;
  applyCellStyle(td, cell);
  return td;
}

/** Render a category-colored cell. */
export function renderCategoryCell(cell: CategoryTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = cell.formattedValue;
  applyCellStyle(td, cell);
  return td;
}

/** Render a cell with an inline bar visualization. */
export function renderBarCell(cell: BarTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'viz-table-bar';
  applyCellStyle(td, cell);

  const fill = document.createElement('div');
  fill.className = 'viz-table-bar-fill';
  fill.style.width = `${Math.round(cell.barWidth * 100)}%`;
  fill.style.left = `${Math.round(cell.barOffset * 100)}%`;
  fill.style.background = cell.barColor;
  td.appendChild(fill);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'viz-table-bar-value';
  valueSpan.textContent = cell.formattedValue;
  td.appendChild(valueSpan);

  return td;
}

/**
 * Format a sparkline endpoint value for display.
 * Keeps it compact: no decimals for values >= 100, one decimal otherwise.
 */
function formatSparklineValue(v: number): string {
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (Math.abs(v) >= 100) {
    return v.toFixed(0);
  }
  return v.toFixed(1);
}

/** Render a cell with an inline sparkline SVG. */
export function renderSparklineCell(cell: SparklineTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  applyCellStyle(td, cell);

  const sparklineData = cell.sparklineData;
  if (!sparklineData || sparklineData.count === 0) {
    td.textContent = cell.formattedValue || '';
    return td;
  }

  // Add aria-label describing the trend for screen readers
  const trendDescription = describeSparklineTrend(sparklineData);
  if (!td.getAttribute('aria-label')) {
    td.setAttribute('aria-label', trendDescription);
  }

  const wrapper = document.createElement('span');
  wrapper.className = 'viz-table-sparkline';

  const svgNS = 'http://www.w3.org/2000/svg';

  if (sparklineData.type === 'line') {
    // Infrographic-style sparkline: SVG polyline fills cell width via percentage x-coords.
    // Dots are HTML elements (not SVG circles) to avoid aspect-ratio distortion.
    // Labels are HTML below the SVG.
    const svgH = 28;
    const padY = 4;
    const lineH = svgH - padY * 2;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('xmlns', svgNS);
    svg.style.height = `${svgH}px`;

    // Compute y positions in pixel space (no viewBox scaling)
    const yPositions = sparklineData.points.map((p) => padY + (1 - p.y) * lineH);

    // SVG polyline doesn't support % in points attribute, so use a viewBox
    // with a wide aspect ratio and map x to 0-1000 range. preserveAspectRatio="none"
    // stretches the x-axis to fill the cell width. Y values stay in pixel space
    // since viewBox height matches the SVG height. Only the polyline is in the SVG;
    // dots are HTML elements to avoid circle distortion from the non-uniform scaling.
    const viewW = 1000;
    svg.setAttribute('viewBox', `0 0 ${viewW} ${svgH}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const ptsScaled = sparklineData.points.map((p, i) => ({
      x: p.x * viewW,
      y: yPositions[i],
    }));
    const scaledPointsStr = ptsScaled.map((p) => `${p.x},${p.y}`).join(' ');

    const polyline = document.createElementNS(svgNS, 'polyline');
    polyline.setAttribute('points', scaledPointsStr);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', sparklineData.color);
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('stroke-linejoin', 'round');
    polyline.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(polyline);

    wrapper.appendChild(svg);

    // HTML dots at start and end (positioned absolutely over the SVG)
    const firstY = yPositions[0];
    const lastY = yPositions[yPositions.length - 1];
    const dotSize = 5;

    const startDot = document.createElement('span');
    startDot.className = 'viz-table-sparkline-dot';
    startDot.style.left = '0';
    startDot.style.top = `${firstY - dotSize / 2}px`;
    startDot.style.background = sparklineData.color;
    wrapper.appendChild(startDot);

    const endDot = document.createElement('span');
    endDot.className = 'viz-table-sparkline-dot';
    endDot.style.right = '0';
    endDot.style.top = `${lastY - dotSize / 2}px`;
    endDot.style.background = sparklineData.color;
    wrapper.appendChild(endDot);

    // HTML labels below the SVG, positioned at left and right edges
    const labelsRow = document.createElement('span');
    labelsRow.className = 'viz-table-sparkline-labels';
    labelsRow.style.color = sparklineData.color;

    const startLabel = document.createElement('span');
    startLabel.textContent = formatSparklineValue(sparklineData.startValue);
    labelsRow.appendChild(startLabel);

    const endLabel = document.createElement('span');
    endLabel.textContent = formatSparklineValue(sparklineData.endValue);
    labelsRow.appendChild(endLabel);

    wrapper.appendChild(labelsRow);
  } else if (sparklineData.type === 'column') {
    // Vertical bars at proportional heights
    const width = 80;
    const height = 20;
    const padding = 2;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-hidden', 'true');

    const barCount = sparklineData.bars.length;
    if (barCount > 0) {
      const gap = 1;
      const barW = Math.max(1, (innerW - gap * (barCount - 1)) / barCount);

      for (let i = 0; i < barCount; i++) {
        const barH = Math.max(1, sparklineData.bars[i] * innerH);
        const x = padding + i * (barW + gap);
        const y = padding + innerH - barH;

        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(barW));
        rect.setAttribute('height', String(barH));
        rect.setAttribute('rx', '1.5');
        rect.setAttribute('fill', sparklineData.color);
        svg.appendChild(rect);
      }
    }

    wrapper.appendChild(svg);
  } else {
    // 'bar' type: horizontal bars at proportional widths
    const width = 80;
    const height = 20;
    const padding = 2;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-hidden', 'true');

    const barCount = sparklineData.bars.length;
    if (barCount > 0) {
      const gap = 1;
      const barH = Math.max(1, (innerH - gap * (barCount - 1)) / barCount);

      for (let i = 0; i < barCount; i++) {
        const barW = Math.max(1, sparklineData.bars[i] * innerW);
        const x = padding;
        const y = padding + i * (barH + gap);

        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(barW));
        rect.setAttribute('height', String(barH));
        rect.setAttribute('rx', '1.5');
        rect.setAttribute('fill', sparklineData.color);
        svg.appendChild(rect);
      }
    }

    wrapper.appendChild(svg);
  }

  td.appendChild(wrapper);

  return td;
}

/** Render a cell with an image. */
export function renderImageCell(cell: ImageTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  applyCellStyle(td, cell);

  const wrapper = document.createElement('span');
  wrapper.className = `viz-table-image${cell.rounded ? ' viz-table-image-rounded' : ''}`;

  const img = document.createElement('img');
  img.src = cell.src;
  img.alt = cell.formattedValue || '';
  img.width = cell.imageWidth;
  img.height = cell.imageHeight;
  img.loading = 'lazy';

  wrapper.appendChild(img);
  td.appendChild(wrapper);

  return td;
}

/** Render a cell with a country flag emoji. */
export function renderFlagCell(cell: FlagTableCell): HTMLTableCellElement {
  const td = document.createElement('td');
  applyCellStyle(td, cell);

  const span = document.createElement('span');
  span.className = 'viz-table-flag';
  span.setAttribute('role', 'img');

  if (cell.countryCode && cell.countryCode.length === 2) {
    const countryName = getCountryName(cell.countryCode);
    span.textContent = countryToEmoji(cell.countryCode);
    span.setAttribute('aria-label', `Flag: ${countryName}`);
  } else {
    span.textContent = cell.formattedValue;
    span.setAttribute('aria-label', cell.formattedValue);
  }

  td.appendChild(span);

  return td;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/** Render any table cell by dispatching on its cellType. */
export function renderCell(cell: TableCell): HTMLTableCellElement {
  switch (cell.cellType) {
    case 'text':
      return renderTextCell(cell);
    case 'heatmap':
      return renderHeatmapCell(cell);
    case 'category':
      return renderCategoryCell(cell);
    case 'bar':
      return renderBarCell(cell);
    case 'sparkline':
      return renderSparklineCell(cell);
    case 'image':
      return renderImageCell(cell);
    case 'flag':
      return renderFlagCell(cell);
    default:
      // Exhaustive check fallback
      return renderTextCell(cell as TextTableCell);
  }
}
