/**
 * Export utilities: serialize charts to SVG, PNG, or CSV.
 *
 * - SVG: serializes the rendered DOM element via XMLSerializer
 * - PNG: renders SVG to canvas, then extracts as Blob
 * - CSV: converts a data array to comma-separated text
 */

/**
 * Serialize an SVG element to an XML string.
 *
 * @param svgElement - The rendered SVG element to serialize.
 * @returns The SVG markup as a string.
 */
export function exportSVG(svgElement: SVGElement): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgElement);
}

export interface PNGExportOptions {
  /** DPI scaling factor. Defaults to 2 for retina-quality output. */
  dpi?: number;
}

/**
 * Render an SVG element to a PNG Blob via a canvas.
 *
 * @param svgElement - The rendered SVG element.
 * @param options - Optional DPI scaling.
 * @returns A Promise resolving to the PNG Blob.
 */
export async function exportPNG(svgElement: SVGElement, options?: PNGExportOptions): Promise<Blob> {
  const dpi = options?.dpi ?? 2;
  const svgString = exportSVG(svgElement);

  const width = parseFloat(svgElement.getAttribute('width') || '600');
  const height = parseFloat(svgElement.getAttribute('height') || '400');

  const canvas = document.createElement('canvas');
  canvas.width = width * dpi;
  canvas.height = height * dpi;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.scale(dpi, dpi);

  const img = new Image();
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<Blob>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

/**
 * Convert an array of data objects to a CSV string.
 *
 * Uses the keys from the first row as column headers.
 * Values are quoted if they contain commas, quotes, or newlines.
 *
 * @param data - Array of row objects.
 * @returns CSV-formatted string.
 */
export function exportCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = [headers.map(csvEscape).join(',')];

  for (const row of data) {
    const values = headers.map((h) => csvEscape(String(row[h] ?? '')));
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
