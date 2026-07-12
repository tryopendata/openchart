/** Default font size for annotation labels. */
export const DEFAULT_ANNOTATION_FONT_SIZE = 13;

/**
 * Default font weight for annotation labels. Regular, not bold: emphasis comes
 * from inline `**bold**` spans, per the NYT/Datawrapper voice.
 */
export const DEFAULT_ANNOTATION_FONT_WEIGHT = 400;

/**
 * Weight the primary text takes when a subtitle is present and the author set no
 * explicit `fontWeight` — the "Feb. 25 / 2015 maximum" lede + context stack.
 */
export const LEDE_FONT_WEIGHT = 700;

/** Subtitles are always regular, so they never inherit a lede weight. */
export const SUBTITLE_FONT_WEIGHT = 400;

/** Font stack used when the theme font isn't threaded through (SSR/legacy paths). */
export const FALLBACK_FONT_FAMILY = 'Inter, system-ui, sans-serif';

/** Default line height multiplier for annotation text. */
export const DEFAULT_LINE_HEIGHT = 1.3;

/** Default fill color for range annotations. */
export const DEFAULT_RANGE_FILL = '#f0c040';

/** Default opacity for range annotations. */
export const DEFAULT_RANGE_OPACITY = 0.15;

/** Default dash pattern for reference lines. */
export const DEFAULT_REFLINE_DASH = '4 3';

// Theme-aware defaults for text and stroke colors
export const LIGHT_TEXT_FILL = '#333333';
export const DARK_TEXT_FILL = '#d1d5db';
export const LIGHT_REFLINE_STROKE = '#888888';
export const DARK_REFLINE_STROKE = '#9ca3af';

// Quiet connector voice: gray hairline leaders (non-arrowed straight, drop-line).
// Arrowed connectors take the label's text ink instead, so the emphasis callout
// reads as one gesture with the words.
export const LIGHT_CONNECTOR_STROKE = '#8f8f8f';
export const DARK_CONNECTOR_STROKE = '#9aa0a6';

// Muted text fill for annotation subtitles (~60% perceived contrast vs primary)
export const LIGHT_MUTED_TEXT_FILL = '#6b7280';
export const DARK_MUTED_TEXT_FILL = '#9ca3af';

// Background fills used as the default "open ring" dot interior
export const LIGHT_DOT_FILL = '#ffffff';
export const DARK_DOT_FILL = '#0a0a0a';

// Surface fills for the text-annotation background plate (the mask that hides
// chart lines behind label text). `background: true` resolves to these, so
// authors don't hardcode '#ffffff' and get light-gray-on-white in dark mode.
export const LIGHT_LABEL_BACKGROUND = '#ffffff';
export const DARK_LABEL_BACKGROUND = '#0a0a0a';

/** Default annotation dot radius in pixels. */
export const DEFAULT_DOT_RADIUS = 4;

/** Default annotation dot stroke width in pixels. */
export const DEFAULT_DOT_STROKE_WIDTH = 1.5;

/** Vertical gap (px) between the primary annotation text and its subtitle. */
export const SUBTITLE_GAP = 2;

/** Subtitle font size multiplier (relative to primary annotation font size). */
export const SUBTITLE_FONT_SIZE_RATIO = 0.85;

/**
 * The subtitle's resolved font size. Rounded, and shared by every caller: the
 * auto-placement pass measures the subtitle to score candidate bounds while the
 * resolver sets the size that actually renders. If one rounds and the other
 * doesn't (13 * 0.85 = 11.05 vs 11), the scored bounds are a lie and the drift
 * flows into collisions and thinning.
 */
export function subtitleFontSize(primaryFontSize: number): number {
  return Math.round(primaryFontSize * SUBTITLE_FONT_SIZE_RATIO);
}

/** Gap (px) between the label bounding box and the start of its connector. */
export const CONNECTOR_STANDOFF = 6;

/**
 * Connectors shorter than this are suppressed: a nub between a label and the
 * marker it's already touching reads as noise, not as a leader.
 *
 * Keep this well under the standoff + marker-pullback overhead (~18px), which
 * is spent before the line is drawn at all. Setting it near or above that
 * overhead makes the default annotation structurally unable to draw a
 * connector, however far the author offsets the label.
 */
export const MIN_CONNECTOR_LENGTH = 8;

/**
 * Arrowhead length along the tangent. The renderer pulls the connector's line end
 * back by exactly this much so the stroke stops at the open V instead of poking
 * through its tip — a hand-copied duplicate on the vanilla side would silently
 * drift the next time this changes.
 */
export const ARROWHEAD_LENGTH = 7;

/** Arrowhead half-width perpendicular to the tangent. */
export const ARROWHEAD_HALF_WIDTH = 3.5;

/**
 * Is a connector of this length worth drawing?
 *
 * An arrowed connector doesn't stroke its full length: the renderer stops the line
 * `ARROWHEAD_LENGTH` short and spends that budget on the head. So a bare
 * `length >= MIN_CONNECTOR_LENGTH` test is arrow-blind — an 8.1px arrowed
 * connector clears it, and then ships a 1.1px stub with an arrowhead stuck on the
 * end. The minimum has to be measured against the part that actually gets stroked,
 * which means the gate has to know about the head.
 *
 * Both suppression sites (`resolveTextAnnotation`, `refreshConnector`) call this
 * instead of comparing against the constant themselves.
 */
export function connectorIsDrawable(length: number, arrow: boolean | undefined): boolean {
  return length - (arrow ? ARROWHEAD_LENGTH : 0) >= MIN_CONNECTOR_LENGTH;
}

/**
 * Default label setback from the data point when using anchor directions.
 *
 * Sized so a bare `{ type: 'text' }` annotation lands clear of its marker and
 * draws a real leader with no offset authoring — a minimal spec should render
 * publication-ready. Authors tighten it with `offset`.
 */
export const ANCHOR_OFFSET = 28;

/** Vertical gap between the top of a drop-line and the top of its label box. */
export const DROP_LINE_TOP_GAP = 4;

/** Padding between annotation and obstacle when nudging. */
export const NUDGE_PADDING = 6;

/** Small inset margin so labels don't touch the SVG edge. */
export const CLAMP_MARGIN = 4;
