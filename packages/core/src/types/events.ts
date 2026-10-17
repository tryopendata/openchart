/**
 * Chart interaction event types.
 *
 * These types define the callback signatures for user interactions with
 * chart elements: clicking marks, hovering, legend toggles, and annotation clicks.
 *
 * Event handlers are optional and passed through MountOptions (vanilla) or
 * ChartProps (React). The vanilla adapter wires DOM event listeners to
 * mark elements and constructs these typed events from the raw browser events.
 */

import type { Annotation, DataRow } from './spec';

/** A source-addressed durable edit. Paths use escaped RFC 6901 JSON Pointers. */
export interface EditOp {
  op: 'set' | 'remove' | 'add';
  path: string;
  value?: unknown;
  /** Preconditions on the nearest authored annotation ancestor. */
  expect?: { id?: string; type?: string; text?: string };
}

/** All operations succeed together. Revision is optional host bookkeeping. */
export interface EditTransaction {
  revision?: string | number;
  ops: EditOp[];
}

// ---------------------------------------------------------------------------
// Chrome key identifiers
// ---------------------------------------------------------------------------

/** Identifies a specific chrome text element (title, subtitle, source, byline, footer). */
export type ChromeKey = 'title' | 'subtitle' | 'source' | 'byline' | 'footer';

// ---------------------------------------------------------------------------
// Element references (identity for selection/edit callbacks)
// ---------------------------------------------------------------------------

/**
 * Reference to an editable chart element.
 * Carries enough info to find the element in both the spec and the DOM.
 * The `annotation` variant uses two-tier identity: `id` (when the consumer provides one)
 * and `index` (always available, position in the spec's annotations array).
 */
export type ElementRef =
  | {
      type: 'annotation';
      index: number;
      id?: string;
      /** RFC 6901 JSON Pointer to the edited property in the spec. */
      path?: string;
      /** Rendered facet instance; source identity remains index/id/path. */
      facetInstance?: string;
    }
  | {
      type: 'chrome';
      key: ChromeKey;
      /** RFC 6901 JSON Pointer to the edited property in the spec. */
      path?: string;
    }
  | {
      type: 'legend';
      /** RFC 6901 JSON Pointer to the edited property in the spec. */
      path?: string;
    }
  | {
      type: 'legend-entry';
      series: string;
      index: number;
      /** RFC 6901 JSON Pointer to the edited property in the spec. */
      path?: string;
    };

/** Helper constructors for ergonomic ElementRef creation. */
export const elementRef = {
  annotation: (
    index: number,
    id?: string,
    path?: string,
  ): Extract<ElementRef, { type: 'annotation' }> => ({
    type: 'annotation',
    index,
    ...(id !== undefined ? { id } : {}),
    ...(path !== undefined ? { path } : {}),
  }),
  chrome: (key: ChromeKey, path?: string): ElementRef => ({
    type: 'chrome',
    key,
    ...(path !== undefined ? { path } : {}),
  }),
  legend: (path?: string): ElementRef => ({
    type: 'legend',
    ...(path !== undefined ? { path } : {}),
  }),
  legendEntry: (series: string, index: number, path?: string): ElementRef => ({
    type: 'legend-entry',
    series,
    index,
    ...(path !== undefined ? { path } : {}),
  }),
} as const;

// ---------------------------------------------------------------------------
// Mark events
// ---------------------------------------------------------------------------

/**
 * Event fired when a user interacts with a data mark (bar, point, line segment, etc.).
 *
 * Contains the underlying data row, the series it belongs to (if multi-series),
 * the position within the chart container, and the raw browser MouseEvent.
 */
export interface MarkEvent {
  /** The data row associated with the mark that was interacted with. */
  datum: DataRow;
  /** Series identifier, if the chart has multiple series (e.g. multi-line). */
  series?: string;
  /** Position of the interaction relative to the chart container. */
  position: { x: number; y: number };
  /** The raw browser MouseEvent. */
  event: MouseEvent;
}

// ---------------------------------------------------------------------------
// Chart event handler interface
// ---------------------------------------------------------------------------

/**
 * Event handler callbacks for chart interactions.
 *
 * All handlers are optional. Pass these through MountOptions (vanilla adapter)
 * or ChartProps (React component) to receive interaction callbacks.
 */
export interface ChartEventHandlers {
  /**
   * Explicitly enable or disable edit interactions (drag, select, keyboard
   * delete/edit). When true, the interaction layer is wired even without
   * onEdit. When false, all edit interactions are suppressed even when
   * onEdit is provided. When omitted, each interaction block uses its
   * existing callback-presence gate.
   */
  editable?: boolean;
  /** Called when a data mark is clicked. */
  onMarkClick?: (event: MarkEvent) => void;
  /** Called when the mouse enters a data mark. */
  onMarkHover?: (event: MarkEvent) => void;
  /** Called when the mouse leaves a data mark. */
  onMarkLeave?: () => void;
  /** Called when a legend entry is toggled (clicked to show/hide a series). */
  onLegendToggle?: (series: string, visible: boolean) => void;
  /**
   * Called when the series search (`seriesSearch`) changes the highlight set.
   * Receives the full set of highlighted values after the change, including
   * the authored `encoding.color.highlight` baseline.
   */
  onHighlightChange?: (values: string[]) => void;
  /** Called when an annotation element is clicked. */
  onAnnotationClick?: (annotation: Annotation, event: MouseEvent, element: ElementRef) => void;
  /** Unified edit callback. Fires for any spec-modifying edit (repositioning, deletion, text editing). */
  onEdit?: (transaction: EditTransaction) => void;
  /** Optional source revision, stamped on emitted transactions. */
  revision?: string | number;
  /** Fired when an element is selected via click or programmatic select(). */
  onSelect?: (element: ElementRef) => void;
  /** Fired when the current element is deselected (click empty, Escape, or new selection replaces old). */
  onDeselect?: (element: ElementRef) => void;
  /**
   * Fired when a "you draw it" (`youDrawIt`) drawing is revealed (button click
   * or programmatic reveal), with the reader's guess in data coordinates,
   * ordered by x. For newsrooms aggregating reader guesses.
   */
  onReveal?: (guess: Array<{ x: string | number; y: number }>) => void;
}
