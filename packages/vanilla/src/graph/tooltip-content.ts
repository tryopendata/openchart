/** Graph tooltip content: library defaults, optionally passed through a host formatter. */

import type { TooltipContent } from '@opendata-ai/openchart-core';
import type { GraphCompilation } from '@opendata-ai/openchart-engine';
import { buildEdgeTooltip } from '@opendata-ai/openchart-engine';
import type { TooltipManager } from '../tooltip';
import type { GraphMountOptions, GraphTooltipFormatter } from './mount-types';

export interface GraphTooltipContext {
  options: GraphMountOptions | undefined;
  manager(): TooltipManager | null;
  compilation(): GraphCompilation;
}

export interface GraphTooltips {
  /** Show a node's tooltip at a screen position. */
  showNode(nodeId: string, data: Record<string, unknown>, x: number, y: number): void;
  /** Show an edge's tooltip (default content built lazily) at a screen position. */
  showEdge(edgeId: string, data: Record<string, unknown>, x: number, y: number): void;
}

export function createGraphTooltips(ctx: GraphTooltipContext): GraphTooltips {
  /** The configured tooltip formatter, or null when tooltips are plain. */
  function tooltipFormatter(): GraphTooltipFormatter | null {
    const t = ctx.options?.tooltip;
    return t && typeof t === 'object' ? (t.formatter ?? null) : null;
  }

  /** Route a formatter's return value to the tooltip manager (or hide on null). */
  function applyFormatterResult(
    tooltipManager: TooltipManager,
    result: TooltipContent | string | HTMLElement | null,
    x: number,
    y: number,
  ): void {
    if (result === null) {
      tooltipManager.hide();
    } else if (typeof result === 'string') {
      tooltipManager.show({ text: result }, x, y);
    } else if (result instanceof HTMLElement) {
      tooltipManager.show({ element: result }, x, y);
    } else {
      tooltipManager.show(result, x, y);
    }
  }

  function show(
    kind: 'node' | 'edge',
    defaults: TooltipContent,
    data: Record<string, unknown>,
    x: number,
    y: number,
  ): void {
    const tooltipManager = ctx.manager();
    if (!tooltipManager) return;
    const formatter = tooltipFormatter();
    if (!formatter) {
      tooltipManager.show(defaults, x, y);
      return;
    }
    applyFormatterResult(tooltipManager, formatter({ kind, data }, defaults), x, y);
  }

  return {
    showNode(nodeId, data, x, y) {
      const defaults = ctx.compilation().tooltipDescriptors.get(nodeId);
      if (!defaults) return;
      show('node', defaults, data, x, y);
    },
    showEdge(edgeId, data, x, y) {
      const edge = ctx.compilation().edges.find((e) => `${e.source}->${e.target}` === edgeId);
      const defaults = edge ? buildEdgeTooltip(edge) : { title: edgeId, fields: [] };
      show('edge', defaults, data, x, y);
    },
  };
}
