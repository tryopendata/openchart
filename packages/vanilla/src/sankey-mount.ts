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
  SankeyLinkMark,
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
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
import { resolveDarkMode } from './resolve-dark-mode';
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
  /** Show the OpenData watermark. Defaults to true. */
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
// Constants
// ---------------------------------------------------------------------------

/** Opacity for links on the hovered node's path. */
const HIGHLIGHT_OPACITY = 0.7;
/** Opacity for links off the path. Low enough to read as context, not flow. */
const DIM_OPACITY = 0.12;
/** Opacity for nodes and labels off the path. */
const NODE_DIM_OPACITY = 0.3;

/**
 * Seeds for a trace: which nodes to walk upstream from, which to walk
 * downstream from, plus any link keys that are on the path by construction.
 *
 * A node hover seeds both directions from that node. A link hover seeds
 * upstream from the source and downstream from the target, so the highlight
 * is the one path running through the hovered link rather than every sibling
 * ribbon out of the source and into the target.
 */
interface TraceSeeds {
  up: string[];
  down: string[];
  links?: string[];
}

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

  // Set when webfonts have loaded and a recompile is owed. The next render()
  // that recompiles flips data-oc-fonts-state to 'ready' and clears this, so
  // the attribute stays honest when resize() defers to pendingResize during
  // the entrance animation.
  let fontsReloadPending = false;

  // Apply the root class up front so getComputedStyle sees --oc-font-family
  // before the text measurer is built.
  container.classList.add('oc-sankey-root');

  // Resolve the effective font the way compile() will: compile merges
  // { ...spec.theme, ...options.theme }, so options.theme wins over the
  // spec-level theme; fall back to the container's computed font. Measuring a
  // different font than gets rendered desyncs layout metrics and the reload watcher.
  function resolveEffectiveFont(): string {
    return (
      options?.theme?.fonts?.family ??
      currentSpec.theme?.fonts?.family ??
      resolveFontFamily(container)
    );
  }
  let fontFamily = resolveEffectiveFont();
  let measureText = createMeasureText(fontFamily);
  let renderGen = 0;

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

    const nodesById = new Map<string, (typeof layout.nodes)[number]>();
    for (const n of layout.nodes) {
      if (!nodesById.has(n.nodeId)) nodesById.set(n.nodeId, n);
    }

    // Wire tooltip on node elements
    const nodeElements = svg.querySelectorAll('.oc-sankey-node');
    for (const el of nodeElements) {
      const markId = el.getAttribute('data-mark-id');
      if (!markId) continue;

      const content = layout.tooltipDescriptors.get(markId);
      const nodeId = el.getAttribute('data-node-id');
      const nodeData = nodeId ? (nodesById.get(nodeId)?.data ?? {}) : {};

      const handleMouseEnter = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        if (content && tooltipManager) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        options?.onNodeHover?.(nodeData);
        if (nodeId) highlightPath(svg, { up: [nodeId], down: [nodeId] }, layout);
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
        if (sourceId && targetId) {
          highlightPath(
            svg,
            { up: [sourceId], down: [targetId], links: [`${sourceId}->${targetId}`] },
            layout,
          );
        }
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
        resetLinkOpacity(svg, layout);
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
   * Trace the path through a set of seed nodes: everything upstream of the
   * `up` seeds and everything downstream of the `down` seeds, links included.
   *
   * A sankey answers "where did this come from and where does it go", so
   * lighting only the direct neighbors stops the answer one hop short. Returns
   * the node ids and the "source->target" link keys on the path.
   */
  function tracePath(
    layout: SankeyLayout,
    seeds: TraceSeeds,
  ): { nodes: Set<string>; links: Set<string> } {
    const out = new Map<string, typeof layout.links>();
    const inn = new Map<string, typeof layout.links>();
    for (const link of layout.links) {
      const o = out.get(link.sourceId);
      if (o) o.push(link);
      else out.set(link.sourceId, [link]);
      const i = inn.get(link.targetId);
      if (i) i.push(link);
      else inn.set(link.targetId, [link]);
    }

    const nodes = new Set<string>([...seeds.up, ...seeds.down]);
    const links = new Set<string>(seeds.links ?? []);

    const walk = (
      adjacency: Map<string, typeof layout.links>,
      seedIds: string[],
      nextId: (l: SankeyLinkMark) => string,
    ) => {
      const queue = [...seedIds];
      const seen = new Set<string>(seedIds);
      while (queue.length > 0) {
        const id = queue.shift() as string;
        for (const link of adjacency.get(id) ?? []) {
          links.add(`${link.sourceId}->${link.targetId}`);
          const next = nextId(link);
          nodes.add(next);
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    };

    walk(out, seeds.down, (l) => l.targetId);
    walk(inn, seeds.up, (l) => l.sourceId);

    return { nodes, links };
  }

  /**
   * Dim everything that is not on the traced path: off-path links go to a whisper,
   * off-path nodes and their labels to the shared hover dim.
   */
  function highlightPath(svg: SVGSVGElement, seeds: TraceSeeds, layout: SankeyLayout): void {
    const { nodes: onNodes, links: onLinks } = tracePath(layout, seeds);

    for (const el of svg.querySelectorAll('.oc-sankey-link')) {
      const path = el.querySelector('path');
      if (!path) continue;
      const source = el.getAttribute('data-source');
      const target = el.getAttribute('data-target');
      const onPath = onLinks.has(`${source}->${target}`);
      path.setAttribute('fill-opacity', String(onPath ? HIGHLIGHT_OPACITY : DIM_OPACITY));
    }

    for (const el of svg.querySelectorAll('.oc-sankey-node, .oc-sankey-label')) {
      const nid = el.getAttribute('data-node-id');
      if (!nid) continue;
      (el as SVGElement).style.opacity = onNodes.has(nid) ? '1' : String(NODE_DIM_OPACITY);
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

    // Restore all node and label opacities
    for (const el of svg.querySelectorAll('.oc-sankey-node, .oc-sankey-label')) {
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
    const shouldAnimate = isFirstRender && !!currentLayout.animation?.enter;
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

    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);

    // This render recompiled with the loaded webfonts; publish 'ready' now
    // rather than right after the fonts-ready resize() (which may have deferred
    // to pendingResize during the entrance animation).
    if (fontsReloadPending) {
      fontsReloadPending = false;
      container.dataset.ocFontsState = 'ready';
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function update(newSpec: SankeySpec): void {
    if (destroyed) return;
    currentSpec = newSpec;
    // A new spec can change theme.fonts.family; rebuild the measurer so layout
    // measures the font compile will actually render with.
    const nextFont = resolveEffectiveFont();
    if (nextFont !== fontFamily) {
      fontFamily = nextFont;
      measureText = createMeasureText(fontFamily);
    }
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
    container.classList.remove('oc-sankey-root');
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  try {
    currentLayout = compile();

    // Determine if we should animate
    const shouldAnimate = !!currentLayout.animation?.enter;
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

    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);
  } catch (err) {
    console.error('[viz] Sankey mount failed:', err);
    // Re-throw so callers can handle the error rather than silently returning a broken instance
    throw err;
  }

  // Recompile once after webfonts load so late-swapping fonts don't leave
  // node labels measured against fallback metrics.
  const fontsPending = scheduleFontReload(
    fontFamily,
    () => !destroyed,
    () => {
      // Mark the reload owed, then recompile. render() flips the attribute to
      // 'ready' once it actually recompiles, including the pendingResize replay
      // after the entrance animation finishes.
      fontsReloadPending = true;
      resize();
    },
  );
  container.dataset.ocFontsState = fontsPending ? 'pending' : 'ready';

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
