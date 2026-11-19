/** `chart.export()`: serialize the rendered chart as SVG, raster, GIF, or CSV. */

import type { ChartLayout, ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { cancelAnimations } from './animation';
import {
  exportCSV,
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type SVGExportOptions,
} from './export';
import { materializeCanvasModeSVG } from './export-canvas';
import type { GIFExportOptions } from './export-gif';
import { exportEntranceGIF } from './export-gif-lazy';
import type { ChartInstance, ExportOptions } from './mount-types';
import type { ScatterCanvasLayer } from './scatter-canvas/layer';
import { renderChartSVG } from './svg-renderer';
import { prepareSettledExportTheme } from './theme-style-block';

/** The mounted chart as export reads it at call time. */
export interface ExportState {
  svgElement: SVGElement | null;
  canvasLayer: ScatterCanvasLayer | null;
  currentLayout: ChartLayout;
  currentSpec: ChartSpec | LayerSpec;
}

export function createChartExporter(state: () => ExportState): ChartInstance['export'] {
  function doExport(format: 'svg'): string;
  function doExport(format: 'svg-with-fonts', exportOptions?: SVGExportOptions): Promise<string>;
  function doExport(format: 'png', exportOptions?: ExportOptions): Promise<Blob>;
  function doExport(format: 'jpg', exportOptions?: ExportOptions): Promise<Blob>;
  function doExport(format: 'gif', exportOptions?: GIFExportOptions): Promise<Blob>;
  function doExport(format: 'csv'): string;
  function doExport(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg' | 'gif' | 'csv',
    exportOptions?: ExportOptions | GIFExportOptions,
  ): string | Promise<Blob> | Promise<string> {
    const { svgElement, canvasLayer, currentLayout, currentSpec } = state();
    if (!svgElement) {
      throw new Error('Chart is not rendered yet');
    }
    // In canvas mode the on-screen SVG has no dots, no gridlines and no
    // background -- the canvas owns those. Serializing it would export an
    // empty chart, so every format works off a materialized SVG that has the
    // missing half folded back in. Raster formats force the vector path: they
    // are becoming pixels anyway, and it buys parity with SVG mode for free.
    //
    // Only the GIF keeps the entrance stamps (`--oc-*` timing, mark indexes,
    // stack reveals), which its frame sampler reads; it renders animated and
    // then drops the `oc-animate` class so nothing plays on the detached copy.
    // Every other format serializes a settled scene with none of them.
    const animate = format === 'gif';
    const svg =
      canvasLayer && currentLayout.markRenderMode === 'canvas'
        ? materializeCanvasModeSVG(currentLayout, {
            forceVector: format === 'png' || format === 'jpg' || format === 'gif',
            animate,
          })
        : renderChartSVG(currentLayout, document.createElement('div'), { animate });
    if (animate) cancelAnimations(svg);
    // The resolved theme, defaulted into the export options, so class-based
    // chrome fills (metrics, eyebrow dot, legend) survive serialization away from
    // the page stylesheet. An explicit options.theme still wins.
    const theme = 'theme' in currentLayout ? currentLayout.theme : undefined;
    // Re-rendering preserves settled geometry, but the detached scene has no
    // host cascade. Carry the live tokens across unless export overrides them.
    prepareSettledExportTheme(
      svgElement,
      svg,
      exportOptions?.theme ?? theme,
      !!exportOptions?.theme,
    );
    const withTheme = <T extends { theme?: unknown }>(o: T | undefined): T =>
      ({ theme, ...(o ?? {}) }) as T;

    switch (format) {
      case 'svg':
        return exportSVG(svg);
      case 'svg-with-fonts':
        return exportSVGWithFonts(svg, withTheme(exportOptions as SVGExportOptions | undefined));
      case 'png':
        return exportPNG(svg, withTheme(exportOptions as ExportOptions | undefined));
      case 'jpg':
        return exportJPG(svg, withTheme(exportOptions as ExportOptions | undefined));
      case 'gif':
        return exportEntranceGIF(
          svg,
          currentLayout.animation,
          withTheme(exportOptions as GIFExportOptions | undefined),
        );
      case 'csv':
        return exportCSV(
          'data' in currentSpec && Array.isArray(currentSpec.data) ? currentSpec.data : [],
        );
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  return doExport;
}
