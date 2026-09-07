/**
 * Shared graph mount shell.
 *
 * The wrapper, chrome band, legend slot, tooltip manager and resize wiring are
 * identical whether the graph paints on a 2D canvas or a WebGL scene, so they
 * live here and both renderers build on top. The renderer owns only the surface
 * it mounts between the chrome and the legend, plus its simulation, camera and
 * interaction state.
 *
 * See {@link GraphShell} in ./renderer-registry for the contract.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import type { GraphCompilation } from '@opendata-ai/openchart-engine';
import type { GraphMountOptions } from '../graph-mount';
import { observeResize } from '../resize-observer';
import { resolveDarkMode } from '../resolve-dark-mode';
import { resolvedSurface } from '../theme-tokens';
import { createTooltipManager } from '../tooltip';
import type { GraphShell } from './renderer-registry';

/** Minimum surface height, so a collapsed container still paints something. */
const MIN_SURFACE_HEIGHT = 200;

/**
 * Container size used for compilation. Falls back to 600x400 for an unmeasured
 * container (happy-dom, or a mount before first layout).
 */
export function getContainerDimensions(container: HTMLElement): {
  width: number;
  height: number;
} {
  const rect = container.getBoundingClientRect();
  return {
    width: Math.max(rect.width || 600, 100),
    height: Math.max(rect.height || 400, 100),
  };
}

/**
 * Build the wrapper/chrome/legend/tooltip scaffolding and mount it into the
 * container. The returned shell is handed to whichever renderer the compilation
 * selected.
 */
export function createGraphShell(
  container: HTMLElement,
  spec: GraphSpec,
  compilation: GraphCompilation,
  options: GraphMountOptions | undefined,
  warn: (message: string) => void,
): GraphShell {
  const isDark = resolveDarkMode(options?.darkMode);

  const wrapper = document.createElement('div');
  wrapper.className = isDark ? 'oc-graph-wrapper oc-dark' : 'oc-graph-wrapper';
  if (isDark) {
    container.classList.add('oc-dark');
  } else {
    container.classList.remove('oc-dark');
  }

  // Apply theme colors as CSS custom properties so chrome HTML picks them up.
  // Without this, consumer-supplied theme.colors.text only affects canvas-drawn
  // labels but not the HTML title/subtitle which read from --oc-text.
  const resolvedTheme = compilation.theme;
  if (resolvedTheme) {
    const s = wrapper.style;
    // The graph paints on an opaque canvas, so a transparent theme background
    // resolves to the mode's --oc-bg token. This is the single source for the
    // graph surface: the node knockout rings are cut in the same color.
    s.setProperty('--oc-bg', resolvedSurface(resolvedTheme));
    s.setProperty('--oc-text', resolvedTheme.colors.text);
    s.setProperty('--oc-text-secondary', resolvedTheme.colors.neutral.secondary);
    s.setProperty('--oc-text-muted', resolvedTheme.colors.axis);
    s.setProperty('--oc-border', resolvedTheme.colors.neutral.border);
    s.setProperty('--oc-font-family', resolvedTheme.fonts.family);
    s.fontFamily = resolvedTheme.fonts.family;
  }

  const chromeEl = document.createElement('div');
  chromeEl.className = 'oc-graph-chrome';
  wrapper.appendChild(chromeEl);

  // The legend slot is created up front so `mountSurface` can insert the
  // renderer's surface before it and keep the chrome / surface / legend order.
  // The mount option wins over the spec, so a host can override a spec it
  // doesn't own.
  const legendSetting = options?.legend ?? spec.legend;
  let legendEl: HTMLElement | null = null;
  if (legendSetting !== false) {
    legendEl = document.createElement('div');
    legendEl.className = 'oc-graph-legend';
    wrapper.appendChild(legendEl);
  }

  container.appendChild(wrapper);

  const tooltipManager = options?.tooltip !== false ? createTooltipManager(wrapper) : null;

  const shell: GraphShell = {
    container,
    wrapper,
    chromeEl,
    legendEl,
    tooltipManager,
    isDark,

    mountSurface(el: HTMLElement): void {
      if (legendEl) wrapper.insertBefore(el, legendEl);
      else wrapper.appendChild(el);
    },

    renderChrome(next: GraphCompilation): void {
      let html = '';

      if (next.chrome.title) {
        html += `<h2 class="oc-title">${escapeHtml(next.chrome.title.text)}</h2>`;
      }
      if (next.chrome.subtitle) {
        html += `<p class="oc-subtitle">${escapeHtml(next.chrome.subtitle.text)}</p>`;
      }

      chromeEl.innerHTML = html;

      // Hide chrome if empty
      chromeEl.style.display = html ? '' : 'none';
    },

    /**
     * Keep the chrome block out of the legend's column: the title/subtitle wrap
     * before they reach the legend box instead of running underneath it. No-op
     * when there's no legend (or it has no measurable width, e.g. in happy-dom).
     */
    syncChromeInset(): void {
      const legendW = legendEl?.offsetWidth ?? 0;
      chromeEl.style.right = legendW > 0 ? `${legendW + 24}px` : '';
    },

    getSize(): { width: number; height: number } {
      const { width, height } = getContainerDimensions(container);
      return { width, height: Math.max(height, MIN_SURFACE_HEIGHT) };
    },

    observeResize(callback: () => void): () => void {
      if (options?.responsive === false) return () => {};
      return observeResize(container, () => {
        callback();
      });
    },

    warn,

    destroy(): void {
      tooltipManager?.destroy();
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      container.classList.remove('oc-dark');
    },
  };

  return shell;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
