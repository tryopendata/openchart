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

import type { Annotation, AnnotationOffset, DataRow, TextAnnotation } from './spec';

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
  /** Called when a data mark is clicked. */
  onMarkClick?: (event: MarkEvent) => void;
  /** Called when the mouse enters a data mark. */
  onMarkHover?: (event: MarkEvent) => void;
  /** Called when the mouse leaves a data mark. */
  onMarkLeave?: () => void;
  /** Called when a legend entry is toggled (clicked to show/hide a series). */
  onLegendToggle?: (series: string, visible: boolean) => void;
  /** Called when an annotation element is clicked. */
  onAnnotationClick?: (annotation: Annotation, event: MouseEvent) => void;
  /** Called when a text annotation label is dragged to a new position. */
  onAnnotationEdit?: (annotation: TextAnnotation, updatedOffset: AnnotationOffset) => void;
}
