/**
 * Sankey mount API: the main entry point for vanilla JS sankey usage.
 *
 * createSankey() takes a container, SankeySpec, and options, compiles the
 * sankey, renders it as SVG, sets up responsive resizing, tooltip interaction,
 * hover highlighting, and returns a SankeyInstance with update/resize/export/destroy.
 */

import type {
  CompileOptions,
  DarkMode,
  SankeyLayout,
  SankeySpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { compileSankey } from '@opendata-ai/openchart-engine';
import { cancelAnimations, setupAnimationCleanup } from './animation';
import {
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type JPGExportOptions,
  type SVGExportOptions,
} from './export';
import { createMeasureText } from './measure-text';
import { observeResize } from './resize-observer';
import { renderSankeySVG } from './sankey-renderer';
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SankeyMountOptions {
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting: "auto" (system pref), "force", or "off". */
  darkMode?: DarkMode;
  /** Enable responsive resizing. Defaults to true. */
  responsive?: boolean;
  /** Show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Show tooltips on hover. Defaults to true. */
  tooltip?: boolean;
  /** Callback when a node is clicked. */
  onNodeClick?: (node: Record<string, unknown>) => void;
  /** Callback when a link is clicked. */
  onLinkClick?: (link: Record<string, unknown>) => void;
  /** Callback when a node is hovered (null on mouse leave). */
  onNodeHover?: (node: Record<string, unknown> | null) => void;
  /** Callback when a link is hovered (null on mouse leave). */
  onLinkHover?: (link: Record<string, unknown> | null) => void;
}

export interface SankeyInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: SankeySpec): void;
  /** Re-compile at current container dimensions. */
  resize(): void;
  /** Export the sankey diagram. */
  export(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    options?: JPGExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  /** Remove all DOM elements and disconnect observers. */
  destroy(): void;
  /** The current compiled layout. */
  readonly layout: SankeyLayout;
}

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Opacity for links connected to hovered node. */
const HIGHLIGHT_OPACITY = 0.7;
/** Opacity for links NOT connected to hovered node. */
const DIM_OPACITY = 0.15;
/** Opacity for nodes NOT connected to hovered node. */
const NODE_DIM_OPACITY = 0.2;

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a sankey instance from a spec and mount it into a container.
 */
export function createSankey(
  container: HTMLElement,
  spec: SankeySpec,
  options?: SankeyMountOptions,
): SankeyInstance {
  let currentSpec = spec;
  let currentLayout: SankeyLayout;
  let destroyed = false;

  // DOM
  let svgElement: SVGSVGElement | null = null;

  // Subsystems
  let tooltipManager: TooltipManager | null = null;
  let cleanupTooltipEvents: (() => void) | null = null;
  let disconnectResize: (() => void) | null = null;

  // Animation state
  let isFirstRender = true;
  let animationCleanup: (() => void) | null = null;
  let pendingResize = false;

  const measureText = createMeasureText();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  function compile(): SankeyLayout {
    const { width, height } = getContainerDimensions();
    const darkMode = resolveDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      watermark: options?.watermark,
      measureText,
    };

    return compileSankey(currentSpec, compileOpts);
  }

  // ---------------------------------------------------------------------------
  // Tooltip and interaction wiring
  // ---------------------------------------------------------------------------

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: SankeyLayout): () => void {
    const cleanups: Array<() => void> = [];

    // Wire tooltip on node elements
    const nodeElements = svg.querySelectorAll('.oc-sankey-node');
    for (const el of nodeElements) {
      const markId = el.getAttribute('data-mark-id');
      if (!markId) continue;

      const content = layout.tooltipDescriptors.get(markId);
      const nodeId = el.getAttribute('data-node-id');
      const nodeData = nodeId ? (layout.nodes.find((n) => n.nodeId === nodeId)?.data ?? {}) : {};

      const handleMouseEnter = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        if (content && tooltipManager) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        options?.onNodeHover?.(nodeData);
        if (nodeId) highlightConnectedLinks(svg, nodeId, layout);
      };

      const handleMouseMove = (e: Event) => {
        if (content && tooltipManager) {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
      };

      const handleMouseLeave = () => {
        tooltipManager?.hide();
        options?.onNodeHover?.(null);
        resetLinkOpacity(svg, layout);
      };

      const handleClick = () => {
        options?.onNodeClick?.(nodeData);
      };

      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mousemove', handleMouseMove);
      el.addEventListener('mouseleave', handleMouseLeave);
      el.addEventListener('click', handleClick);

      cleanups.push(() => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('mouseleave', handleMouseLeave);
        el.removeEventListener('click', handleClick);
      });
    }

    // Wire tooltip on link elements
    const linkElements = svg.querySelectorAll('.oc-sankey-link');
    for (const el of linkElements) {
      const markId = el.getAttribute('data-mark-id');
      if (!markId) continue;

      const content = layout.tooltipDescriptors.get(markId);
      const sourceId = el.getAttribute('data-source');
      const targetId = el.getAttribute('data-target');
      const linkData = findLinkData(layout, sourceId, targetId);

      const handleMouseEnter = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        if (content && tooltipManager) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        options?.onLinkHover?.(linkData);
      };

      const handleMouseMove = (e: Event) => {
        if (content && tooltipManager) {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
      };

      const handleMouseLeave = () => {
        tooltipManager?.hide();
        options?.onLinkHover?.(null);
      };

      const handleClick = () => {
        options?.onLinkClick?.(linkData);
      };

      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mousemove', handleMouseMove);
      el.addEventListener('mouseleave', handleMouseLeave);
      el.addEventListener('click', handleClick);

      cleanups.push(() => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('mouseleave', handleMouseLeave);
        el.removeEventListener('click', handleClick);
      });
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  /**
   * Find the data record for a link by source/target ids.
   */
  function findLinkData(
    layout: SankeyLayout,
    sourceId: string | null,
    targetId: string | null,
  ): Record<string, unknown> {
    if (!sourceId || !targetId) return {};
    const link = layout.links.find((l) => l.sourceId === sourceId && l.targetId === targetId);
    return link?.data ?? {};
  }

  /**
   * Highlight links connected to a node and dim unconnected links.
   */
  function highlightConnectedLinks(
    svg: SVGSVGElement,
    nodeId: string,
    _layout: SankeyLayout,
  ): void {
    // Collect connected node IDs (the hovered node + its direct neighbors)
    const connectedNodeIds = new Set<string>([nodeId]);
    const linkElements = svg.querySelectorAll('.oc-sankey-link');
    for (const el of linkElements) {
      const source = el.getAttribute('data-source');
      const target = el.getAttribute('data-target');
      const path = el.querySelector('path');
      if (!path) continue;

      const isConnected = source === nodeId || target === nodeId;
      path.setAttribute('fill-opacity', String(isConnected ? HIGHLIGHT_OPACITY : DIM_OPACITY));
      if (isConnected) {
        if (source) connectedNodeIds.add(source);
        if (target) connectedNodeIds.add(target);
      }
    }

    // Dim unconnected nodes (rect + label)
    const nodeElements = svg.querySelectorAll('.oc-sankey-node');
    for (const el of nodeElements) {
      const nid = el.getAttribute('data-node-id');
      if (!nid) continue;
      const isConnected = connectedNodeIds.has(nid);
      (el as SVGElement).style.opacity = isConnected ? '1' : String(NODE_DIM_OPACITY);
    }
  }

  /**
   * Reset all link opacities and node opacities to their original values.
   */
  function resetLinkOpacity(svg: SVGSVGElement, layout: SankeyLayout): void {
    const linkElements = svg.querySelectorAll('.oc-sankey-link');
    for (const el of linkElements) {
      const path = el.querySelector('path');
      if (!path) continue;
      // Look up the original opacity via data attributes rather than positional index
      const source = el.getAttribute('data-source');
      const target = el.getAttribute('data-target');
      const link = layout.links.find((l) => l.sourceId === source && l.targetId === target);
      path.setAttribute('fill-opacity', String(link?.fillOpacity ?? 0.5));
    }

    // Restore all node opacities
    const nodeElements = svg.querySelectorAll('.oc-sankey-node');
    for (const el of nodeElements) {
      (el as SVGElement).style.opacity = '1';
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function render(): void {
    if (destroyed) return;

    // Cancel in-progress animations before tearing down
    if (animationCleanup) {
      animationCleanup();
      animationCleanup = null;
    }
    if (svgElement) {
      cancelAnimations(svgElement);
    }

    // Clean up previous tooltip listeners
    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
    }

    // Remove old SVG
    if (svgElement?.parentNode) {
      svgElement.parentNode.removeChild(svgElement);
    }

    // Compile
    currentLayout = compile();

    // Determine if we should animate
    const shouldAnimate = isFirstRender && currentLayout.animation?.enabled;
    isFirstRender = false;

    // Render
    const animation = shouldAnimate ? currentLayout.animation : undefined;
    svgElement = renderSankeySVG(currentLayout, animation);
    container.appendChild(svgElement);

    // Dark mode class on container
    const isDark = resolveDarkMode(options?.darkMode);
    if (isDark) {
      container.classList.add('oc-dark');
    } else {
      container.classList.remove('oc-dark');
    }

    // Wire tooltip + interaction events
    if (options?.tooltip !== false && svgElement) {
      if (!tooltipManager) {
        tooltipManager = createTooltipManager(container);
      }
      cleanupTooltipEvents = wireTooltipAndInteraction(svgElement, currentLayout);
    }

    // Animation cleanup on first render
    if (shouldAnimate && svgElement) {
      animationCleanup = setupAnimationCleanup(svgElement, () => {
        animationCleanup = null;
        if (pendingResize) {
          pendingResize = false;
          resize();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function update(newSpec: SankeySpec): void {
    if (destroyed) return;
    currentSpec = newSpec;
    isFirstRender = true; // Allow animation on update
    render();
  }

  function resize(): void {
    if (destroyed) return;
    // Skip resize during entrance animation to avoid tearing down the animated SVG.
    // Queued resizes replay once animation completes.
    if (animationCleanup) {
      pendingResize = true;
      return;
    }
    render();
  }

  function doExport(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    exportOptions?: JPGExportOptions,
  ): string | Promise<Blob> | Promise<string> {
    if (!svgElement) {
      throw new Error('Sankey is not rendered yet');
    }

    switch (format) {
      case 'svg':
        return exportSVG(svgElement);
      case 'svg-with-fonts':
        return exportSVGWithFonts(svgElement, exportOptions as SVGExportOptions);
      case 'png':
        return exportPNG(svgElement, exportOptions);
      case 'jpg':
        return exportJPG(svgElement, exportOptions);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    // Cancel entrance animations
    if (animationCleanup) {
      animationCleanup();
      animationCleanup = null;
      pendingResize = false;
    }
    if (svgElement) {
      cancelAnimations(svgElement);
    }

    // Disconnect resize observer
    if (disconnectResize) {
      disconnectResize();
      disconnectResize = null;
    }

    // Clean up tooltip events
    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
    }

    // Destroy tooltip manager
    if (tooltipManager) {
      tooltipManager.destroy();
      tooltipManager = null;
    }

    // Remove SVG
    if (svgElement?.parentNode) {
      svgElement.parentNode.removeChild(svgElement);
    }
    svgElement = null;

    container.classList.remove('oc-dark');
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  try {
    currentLayout = compile();

    // Determine if we should animate
    const shouldAnimate = currentLayout.animation?.enabled;
    isFirstRender = false;

    // Render
    const animation = shouldAnimate ? currentLayout.animation : undefined;
    svgElement = renderSankeySVG(currentLayout, animation);
    container.appendChild(svgElement);

    // Dark mode class on container
    const isDark = resolveDarkMode(options?.darkMode);
    if (isDark) {
      container.classList.add('oc-dark');
    } else {
      container.classList.remove('oc-dark');
    }

    // Wire tooltip + interaction events
    if (options?.tooltip !== false && svgElement) {
      tooltipManager = createTooltipManager(container);
      cleanupTooltipEvents = wireTooltipAndInteraction(svgElement, currentLayout);
    }

    // Animation cleanup
    if (shouldAnimate && svgElement) {
      animationCleanup = setupAnimationCleanup(svgElement, () => {
        animationCleanup = null;
        if (pendingResize) {
          pendingResize = false;
          resize();
        }
      });
    }
  } catch (err) {
    console.error('[viz] Sankey mount failed:', err);
    // Re-throw so callers can handle the error rather than silently returning a broken instance
    throw err;
  }

  // Responsive resize
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => {
      resize();
    });
  }

  return {
    update,
    resize,
    export: doExport,
    destroy,
    get layout() {
      return currentLayout;
    },
  };
}
