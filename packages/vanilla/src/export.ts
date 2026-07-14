/**
 * Export utilities: serialize charts to SVG, PNG, JPG, or CSV.
 *
 * - SVG: serializes the rendered DOM element via XMLSerializer
 * - SVG with fonts: async version that embeds @font-face data URIs
 * - PNG: renders SVG to canvas, then extracts as Blob
 * - JPG: same as PNG but with JPEG compression and background fill
 * - CSV: converts a data array to comma-separated text
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SVGExportOptions {
  /** Embed fonts as base64 data URIs in the SVG. Defaults to true. */
  embedFonts?: boolean;
}

export interface PNGExportOptions extends SVGExportOptions {
  /** DPI scaling factor. Defaults to 2 for retina-quality output. */
  dpi?: number;
}

export interface JPGExportOptions extends PNGExportOptions {
  /** JPEG quality from 0 to 1. Defaults to 0.92. */
  quality?: number;
}

interface FontFaceData {
  family: string;
  weight: string;
  style: string;
  base64: string;
  format: string;
}

// ---------------------------------------------------------------------------
// Dimension parsing
// ---------------------------------------------------------------------------

/**
 * Extract dimensions from an SVG element, trying width/height attributes
 * first, then falling back to viewBox.
 */
function getSVGDimensions(svg: SVGElement): { width: number; height: number } {
  const w = parseFloat(svg.getAttribute('width') || '');
  const h = parseFloat(svg.getAttribute('height') || '');
  if (w && h) return { width: w, height: h };

  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] && parts[3]) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return { width: 600, height: 400 };
}

/**
 * Ensure an SVG string has explicit width/height attributes.
 *
 * When an SVG only has a viewBox (no width/height), browsers loading it as
 * an Image blob may use 300x150 as the intrinsic size instead of the viewBox
 * dimensions. This causes clipping at non-1x DPI scaling. Injecting explicit
 * width/height into the root <svg> tag fixes the intrinsic size.
 */
function ensureSVGDimensions(svgString: string, width: number, height: number): string {
  // If the <svg> already has a width attribute, leave it alone
  if (/^<svg[^>]*\swidth\s*=/.test(svgString)) return svgString;
  // Inject width and height right after <svg
  return svgString.replace(/^(<svg)/, `$1 width="${width}" height="${height}"`);
}

// ---------------------------------------------------------------------------
// Font embedding
// ---------------------------------------------------------------------------

/**
 * Collect unique font-family + font-weight combos from all <text> elements.
 */
function collectUsedFonts(svgElement: SVGElement): Map<string, Set<string>> {
  const fonts = new Map<string, Set<string>>();
  const textElements = svgElement.querySelectorAll('text');

  for (const el of textElements) {
    const family = el.getAttribute('font-family');
    const weight = el.getAttribute('font-weight') || '400';
    if (family) {
      // Take the first font in the stack (e.g., "Inter, sans-serif" → "Inter")
      const primary = family.split(',')[0].trim().replace(/["']/g, '');
      if (!fonts.has(primary)) fonts.set(primary, new Set());
      fonts.get(primary)!.add(String(weight));
    }
  }

  return fonts;
}

/**
 * Find @font-face rules in document stylesheets that match the requested fonts.
 * Returns the src URLs for .woff2 files.
 */
function findFontFaceRules(
  usedFonts: Map<string, Set<string>>,
): Array<{ family: string; weight: string; style: string; url: string; format: string }> {
  const results: Array<{
    family: string;
    weight: string;
    style: string;
    url: string;
    format: string;
  }> = [];

  try {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        // Cross-origin stylesheet, skip
        continue;
      }

      for (const rule of rules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;

        const familyRaw = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
        const weight = rule.style.getPropertyValue('font-weight') || '400';
        const style = rule.style.getPropertyValue('font-style') || 'normal';
        const src = rule.style.getPropertyValue('src');

        const weights = usedFonts.get(familyRaw);
        if (!weights) continue;

        // Check if this weight is used (handle ranges like "100 900")
        const weightMatch = weights.has(weight) || weight.includes(' ');
        if (!weightMatch) continue;

        // Extract woff2 URL from src descriptor
        const woff2Match = src.match(/url\(["']?([^"')]+\.woff2[^"')]*?)["']?\)/);
        if (woff2Match) {
          results.push({
            family: familyRaw,
            weight,
            style,
            url: woff2Match[1],
            format: 'woff2',
          });
        }
      }
    }
  } catch {
    // Stylesheet access failed entirely, return empty
  }

  return results;
}

/**
 * Fetch font files and convert to base64 data URIs.
 */
async function fetchFontsAsBase64(
  fontRules: Array<{ family: string; weight: string; style: string; url: string; format: string }>,
): Promise<FontFaceData[]> {
  const results: FontFaceData[] = [];

  const fetches = fontRules.map(async (rule) => {
    try {
      const response = await fetch(rule.url);
      if (!response.ok) return;
      const buffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      results.push({
        family: rule.family,
        weight: rule.weight,
        style: rule.style,
        base64,
        format: rule.format,
      });
    } catch {
      // Font fetch failed (CORS, network, etc.) - skip this font
    }
  });

  await Promise.all(fetches);
  return results;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Inject @font-face rules with base64 data URIs into the SVG's <defs>.
 */
function injectFontsIntoSVG(svgElement: SVGElement, fonts: FontFaceData[]): void {
  if (fonts.length === 0) return;

  const cssRules = fonts
    .map(
      (f) =>
        `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; font-style: ${f.style}; src: url(data:font/${f.format};base64,${f.base64}) format('${f.format}'); }`,
    )
    .join('\n');

  const ns = 'http://www.w3.org/2000/svg';
  let defs = svgElement.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(ns, 'defs');
    svgElement.insertBefore(defs, svgElement.firstChild);
  }

  const styleEl = document.createElementNS(ns, 'style');
  styleEl.textContent = cssRules;
  defs.insertBefore(styleEl, defs.firstChild);
}

/**
 * Embed fonts into an SVG element by finding matching @font-face rules
 * in the page's stylesheets, fetching the font files, and injecting
 * them as base64 data URIs.
 *
 * Modifies the SVG element in place. Call this before serialization.
 * If font fetching fails for any font, that font is silently skipped
 * and the export proceeds with system font fallback for that face.
 */
async function embedFonts(svgElement: SVGElement): Promise<void> {
  const usedFonts = collectUsedFonts(svgElement);
  if (usedFonts.size === 0) return;

  const fontRules = findFontFaceRules(usedFonts);
  if (fontRules.length === 0) return;

  const fontData = await fetchFontsAsBase64(fontRules);
  injectFontsIntoSVG(svgElement, fontData);
}

// ---------------------------------------------------------------------------
// SVG background color
// ---------------------------------------------------------------------------

/**
 * Read the chart's background color from its first rect element.
 */
function getSVGBackgroundColor(svgElement: SVGElement): string {
  const firstRect = svgElement.querySelector('rect');
  return firstRect?.getAttribute('fill') || '#ffffff';
}

// ---------------------------------------------------------------------------
// SVG export
// ---------------------------------------------------------------------------

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

/**
 * Serialize an SVG element with embedded fonts to an XML string.
 *
 * Collects font-family declarations from the SVG's text elements,
 * finds matching @font-face rules in the page's stylesheets, fetches
 * the font files, and embeds them as base64 data URIs. The resulting
 * SVG is self-contained and renders correctly without external fonts.
 *
 * @param svgElement - The rendered SVG element to serialize.
 * @param options - Export options.
 * @returns A Promise resolving to the SVG markup as a string.
 */
export async function exportSVGWithFonts(
  svgElement: SVGElement,
  options?: SVGExportOptions,
): Promise<string> {
  const clone = svgElement.cloneNode(true) as SVGElement;
  const shouldEmbed = options?.embedFonts ?? true;
  if (shouldEmbed) {
    await embedFonts(clone);
  }
  return exportSVG(clone);
}

// ---------------------------------------------------------------------------
// Raster export (PNG / JPG)
// ---------------------------------------------------------------------------

/**
 * Render an SVG element to a PNG Blob via a canvas.
 *
 * Embeds fonts by default so the exported image matches on-screen rendering.
 * Set `embedFonts: false` to skip font embedding for faster exports.
 *
 * @param svgElement - The rendered SVG element.
 * @param options - Optional DPI scaling and font embedding.
 * @returns A Promise resolving to the PNG Blob.
 */
export async function exportPNG(svgElement: SVGElement, options?: PNGExportOptions): Promise<Blob> {
  const dpi = options?.dpi ?? 2;
  const shouldEmbed = options?.embedFonts ?? true;
  const { width, height } = getSVGDimensions(svgElement);
  const clone = svgElement.cloneNode(true) as SVGElement;

  if (shouldEmbed) {
    await embedFonts(clone);
  }

  const svgString = ensureSVGDimensions(exportSVG(clone), width, height);

  if (!width || !height) {
    throw new Error(`SVG has zero dimensions (width=${width}, height=${height})`);
  }

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
      ctx.drawImage(img, 0, 0, width, height);
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
      reject(
        new Error(
          `Failed to load SVG as image (width=${width}, height=${height}, svgLength=${svgString.length})`,
        ),
      );
    };

    img.src = url;
  });
}

/**
 * Render an SVG element to a JPEG Blob via a canvas.
 *
 * Same pipeline as exportPNG but outputs JPEG with configurable quality.
 * The canvas is filled with the chart's background color before drawing
 * to avoid transparent backgrounds rendering as black in JPEG format.
 *
 * @param svgElement - The rendered SVG element.
 * @param options - Optional DPI scaling, JPEG quality, and font embedding.
 * @returns A Promise resolving to the JPEG Blob.
 */
export async function exportJPG(svgElement: SVGElement, options?: JPGExportOptions): Promise<Blob> {
  const dpi = options?.dpi ?? 2;
  const quality = options?.quality ?? 0.92;
  const shouldEmbed = options?.embedFonts ?? true;
  const { width, height } = getSVGDimensions(svgElement);
  const backgroundColor = getSVGBackgroundColor(svgElement);
  const clone = svgElement.cloneNode(true) as SVGElement;

  if (shouldEmbed) {
    await embedFonts(clone);
  }

  const svgString = ensureSVGDimensions(exportSVG(clone), width, height);

  if (!width || !height) {
    throw new Error(`SVG has zero dimensions (width=${width}, height=${height})`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width * dpi;
  canvas.height = height * dpi;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.scale(dpi, dpi);

  const img = new Image();
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<Blob>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Failed to load SVG as image (width=${width}, height=${height}, svgLength=${svgString.length})`,
        ),
      );
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

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
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
