/**
 * Interactive built-in graph legend.
 *
 * Replaces the old innerHTML legend build in graph-mount with a keyboard- and
 * pointer-accessible control. Node-category rows are buttons (`aria-pressed`)
 * that toggle emphasis; edge-category rows are non-interactive line swatches.
 *
 * The legend is a thin view: it holds no highlight state of its own. Toggling a
 * row calls back into the mount, which owns the single highlight slot and
 * re-renders the legend from the resulting active-category set. Hovering a row
 * previews that category via the same highlight code path.
 */

/** Escape a string for safe interpolation into innerHTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** A node-category legend row. */
export interface GraphLegendNodeEntry {
  label: string;
  color: string;
  count?: number;
  /** Whether this category is currently emphasized (drives the inactive style). */
  active: boolean;
}

/** An edge-category legend row (non-interactive). */
export interface GraphLegendEdgeEntry {
  label: string;
  color: string;
  count?: number;
}

/** Data the legend renders. */
export interface GraphLegendViewData {
  nodes: GraphLegendNodeEntry[];
  edges: GraphLegendEdgeEntry[];
}

/** Callbacks the legend fires; the mount owns the resulting state. */
export interface GraphLegendCallbacks {
  /** Whether node rows toggle emphasis. When false, rows are static labels. */
  interactive: boolean;
  /** Whether to show per-category counts. */
  counts: boolean;
  /** Toggle a node category's emphasis. */
  onToggle(value: string): void;
  /** Hover a node category (null on leave) for a live preview. */
  onHover(value: string | null): void;
}

export interface GraphLegendController {
  /** Re-render from fresh data (e.g. after a toggle or update()). */
  update(data: GraphLegendViewData): void;
  /** Remove listeners and clear the host. */
  destroy(): void;
}

/**
 * Create an interactive legend inside `host`. Returns a controller with
 * `update`/`destroy`. The host is fully owned by the legend (cleared on each
 * update and on destroy).
 */
export function createGraphLegend(
  host: HTMLElement,
  data: GraphLegendViewData,
  callbacks: GraphLegendCallbacks,
): GraphLegendController {
  const listeners: Array<() => void> = [];

  function render(view: GraphLegendViewData): void {
    teardownListeners();
    host.replaceChildren();

    if (view.nodes.length === 0 && view.edges.length === 0) {
      host.style.display = 'none';
      return;
    }
    host.style.display = '';

    for (const entry of view.nodes) {
      host.appendChild(nodeRow(entry));
    }
    for (const entry of view.edges) {
      host.appendChild(edgeRow(entry));
    }
  }

  function nodeRow(entry: GraphLegendNodeEntry): HTMLElement {
    const interactive = callbacks.interactive;
    const el = document.createElement(interactive ? 'button' : 'div');
    el.className = 'oc-graph-legend-item';
    if (!entry.active) el.classList.add('oc-graph-legend-item--inactive');

    if (interactive) {
      const btn = el as HTMLButtonElement;
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(entry.active));
      const onClick = () => callbacks.onToggle(entry.label);
      const onEnter = () => callbacks.onHover(entry.label);
      const onLeave = () => callbacks.onHover(null);
      btn.addEventListener('click', onClick);
      btn.addEventListener('mouseenter', onEnter);
      btn.addEventListener('mouseleave', onLeave);
      listeners.push(() => {
        btn.removeEventListener('click', onClick);
        btn.removeEventListener('mouseenter', onEnter);
        btn.removeEventListener('mouseleave', onLeave);
      });
    }

    el.innerHTML =
      `<span class="oc-graph-legend-swatch" style="background:${escapeHtml(entry.color)}"></span>` +
      `<span class="oc-graph-legend-label">${escapeHtml(entry.label)}</span>` +
      (callbacks.counts && entry.count != null
        ? `<span class="oc-graph-legend-count">${entry.count.toLocaleString()}</span>`
        : '');
    return el;
  }

  function edgeRow(entry: GraphLegendEdgeEntry): HTMLElement {
    const el = document.createElement('div');
    el.className = 'oc-graph-legend-item oc-graph-legend-item--edge';
    el.innerHTML =
      `<span class="oc-graph-legend-swatch oc-graph-legend-swatch--line" style="background:${escapeHtml(entry.color)}"></span>` +
      `<span class="oc-graph-legend-label">${escapeHtml(entry.label)}</span>` +
      (callbacks.counts && entry.count != null
        ? `<span class="oc-graph-legend-count">${entry.count.toLocaleString()}</span>`
        : '');
    return el;
  }

  function teardownListeners(): void {
    for (const off of listeners) off();
    listeners.length = 0;
  }

  render(data);

  return {
    update: render,
    destroy(): void {
      teardownListeners();
      host.replaceChildren();
    },
  };
}
