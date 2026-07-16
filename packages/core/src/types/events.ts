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

import type {
  Annotation,
  AnnotationOffset,
  DataRow,
  RangeAnnotation,
  RefLineAnnotation,
  TextAnnotation,
} from './spec';

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
    }
  | {
      type: 'chrome';
      key: ChromeKey;
      /** RFC 6901 JSON Pointer to the edited property in the spec. */
      path?: string;
    }
  | {
      type: 'series-label';
      series: string;
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
  annotation: (index: number, id?: string, path?: string): ElementRef => ({
    type: 'annotation',
    index,
    id,
    path,
  }),
  chrome: (key: ChromeKey, path?: string): ElementRef => ({ type: 'chrome', key, path }),
  seriesLabel: (series: string, path?: string): ElementRef => ({
    type: 'series-label',
    series,
    path,
  }),
  legend: (path?: string): ElementRef => ({ type: 'legend', path }),
  legendEntry: (series: string, index: number, path?: string): ElementRef => ({
    type: 'legend-entry',
    series,
    index,
    path,
  }),
} as const;

// ---------------------------------------------------------------------------
// Element edit events
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all element edit events.
 * Fired by the `onEdit` callback when any editable chart element is modified.
 * Covers repositioning (drag), deletion (Delete key), and text editing (double-click).
 * Selection events (onSelect/onDeselect) are separate callbacks, not part of this union.
 *
 * For the `annotation` variant:
 * - `annotation` is the ORIGINAL spec annotation (may have a stale or missing offset)
 * - `offset` is the NEW accumulated position after the drag completes
 * - To persist a drag edit back into your spec: `{ ...edit.annotation, offset: edit.offset }`
 */
export type ElementEdit =
  | {
      type: 'annotation';
      element: ElementRef;
      annotation: TextAnnotation;
      offset: AnnotationOffset;
    }
  | {
      type: 'annotation-connector';
      element: ElementRef;
      annotation: TextAnnotation;
      endpoint: 'from' | 'to';
      offset: AnnotationOffset;
    }
  | {
      type: 'range-label';
      element: ElementRef;
      annotation: RangeAnnotation;
      labelOffset: AnnotationOffset;
    }
  | {
      type: 'refline-label';
      element: ElementRef;
      annotation: RefLineAnnotation;
      labelOffset: AnnotationOffset;
    }
  | {
      type: 'annotation-anchor';
      element: ElementRef;
      annotation: TextAnnotation;
      x: string | number;
      y: string | number;
    }
  | { type: 'chrome'; key: ChromeKey; text: string; offset: AnnotationOffset }
  | { type: 'series-label'; series: string; offset: AnnotationOffset }
  | { type: 'legend'; offset: AnnotationOffset }
  /**
   * Transient legend visibility toggle. Reports the same runtime show/hide
   * a reader triggers; not persisted by openchart. To author default-hidden
   * series, set `spec.hiddenSeries` directly. Hosts building spec
   * persistence should generally not write legend-toggle edits back into
   * the authored spec. `hidden: true` means the series was just hidden.
   */
  | { type: 'legend-toggle'; series: string; hidden: boolean }
  | { type: 'add'; annotation: TextAnnotation }
  | { type: 'delete'; element: ElementRef }
  | { type: 'text-edit'; element: ElementRef; oldText: string; newText: string };

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
  onAnnotationClick?: (annotation: Annotation, event: MouseEvent) => void;
  /** Called when a text annotation label is dragged to a new position. */
  onAnnotationEdit?: (annotation: TextAnnotation, updatedOffset: AnnotationOffset) => void;
  /** Unified edit callback. Fires for any spec-modifying edit (repositioning, deletion, text editing). */
  onEdit?: (edit: ElementEdit) => void;
  /** Fired when an element is selected via click or programmatic select(). */
  onSelect?: (element: ElementRef) => void;
  /** Fired when the current element is deselected (click empty, Escape, or new selection replaces old). */
  onDeselect?: (element: ElementRef) => void;
  /** Fired when inline text editing commits. Also flows through onEdit as a 'text-edit' event. */
  onTextEdit?: (element: ElementRef, oldText: string, newText: string) => void;
  /**
   * Fired when a "you draw it" (`youDrawIt`) drawing is revealed (button click
   * or programmatic reveal), with the reader's guess in data coordinates,
   * ordered by x. For newsrooms aggregating reader guesses.
   */
  onReveal?: (guess: Array<{ x: string | number; y: number }>) => void;
}
