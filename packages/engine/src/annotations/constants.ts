/** Default font size for annotation labels. */
export const DEFAULT_ANNOTATION_FONT_SIZE = 12;

/** Default font weight for annotation labels. */
export const DEFAULT_ANNOTATION_FONT_WEIGHT = 400;

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
export const DEFAULT_DOT_RADIUS = 5;

/** Default annotation dot stroke width in pixels. */
export const DEFAULT_DOT_STROKE_WIDTH = 2;

/** Vertical gap (px) between the primary annotation text and its subtitle. */
export const SUBTITLE_GAP = 2;

/** Subtitle font size multiplier (relative to primary annotation font size). */
export const SUBTITLE_FONT_SIZE_RATIO = 0.85;

/** Default label offset when using anchor directions. */
export const ANCHOR_OFFSET = 8;

/** Padding between annotation and obstacle when nudging. */
export const NUDGE_PADDING = 6;

/** Small inset margin so labels don't touch the SVG edge. */
export const CLAMP_MARGIN = 4;
