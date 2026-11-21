/**
 * The house-style section's stops: the chart moves through the library's four
 * presets and then into dark mode. Each stop has a name and one sentence on the
 * look in a reader's terms, and a short list of the theme values that changed
 * from the stop before, for readers who open it. Pure data, computed at build time.
 */
import {
  broadsheet,
  DEFAULT_THEME,
  essay,
  type ThemeConfig,
  terminal,
  wire,
} from "@opendata-ai/openchart-core";

/** The presets in scrub order, by the name the library exports them under. */
export const PRESET_NAMES = ["essay", "wire", "broadsheet", "terminal"] as const;

/** One stop on the scrub. */
export type HouseStyleStop = {
  id: (typeof PRESET_NAMES)[number] | "dark";
  /** The button text and the name shown over the chart. */
  label: string;
  /** The preset the chart wears at this stop. */
  preset: (typeof PRESET_NAMES)[number];
  /** What the stop is, when the label alone does not say: the dark stop is broadsheet in dark mode. */
  variant?: string;
  /** The look, in a reader's terms. */
  description: string;
  theme: ThemeConfig;
  /** Render in dark mode (`darkMode: "force"`); otherwise the preset's light values. */
  dark: boolean;
};

export const HOUSE_STYLE_STOPS: readonly HouseStyleStop[] = [
  {
    id: "essay",
    label: "Essay",
    preset: "essay",
    description:
      "Serif type on warm paper, with room around the chart: the look of a long-form essay.",
    theme: essay,
    dark: false,
  },
  {
    id: "wire",
    label: "Wire",
    preset: "wire",
    description:
      "Monospaced type, tight spacing and plain white: the dense chart a wire service files.",
    theme: wire,
    dark: false,
  },
  {
    id: "broadsheet",
    label: "Broadsheet",
    preset: "broadsheet",
    description:
      "A bold headline under a short red rule, on newsprint white: a broadsheet's graphics page.",
    theme: broadsheet,
    dark: false,
  },
  {
    id: "terminal",
    label: "Terminal",
    preset: "terminal",
    description:
      "A dark screen with one cyan series against grey ones: the chart on a monitoring dashboard.",
    theme: terminal,
    dark: false,
  },
  {
    id: "dark",
    label: "Dark mode",
    preset: "broadsheet",
    variant: "Broadsheet, in dark mode",
    description:
      "The broadsheet look on a dark page. The dark colors are derived from the light ones.",
    theme: broadsheet,
    dark: true,
  },
];

/** One changed value: its path in the theme, and the printed value before and after (absent when unset). */
export type ThemeDiffLine = { path: string; before?: string; after?: string };

/** The most lines a stop lists: the values a reader notices first. */
export const MAX_DIFF_LINES = 5;

type Mode = { theme: ThemeConfig; dark: boolean };
type ModeValue = string | { light: string; dark: string } | undefined;
type ThemeColors = Exclude<NonNullable<ThemeConfig["colors"]>, readonly unknown[]>;

const pick = (value: unknown, dark: boolean): string | undefined => {
  const mode = value as ModeValue;
  return typeof mode === "object" ? (dark ? mode.dark : mode.light) : mode;
};

/** A theme's colors as an object: a bare array is shorthand for the categorical palette. */
const colorsOf = (theme: ThemeConfig): ThemeColors =>
  Array.isArray(theme.colors) ? { categorical: theme.colors } : (theme.colors ?? {});

/** The first family in a font stack, without quotes: what a reader recognises. */
const firstFamily = (stack: string | undefined) => stack?.split(",")[0]?.trim().replace(/"/g, "");

const quoted = (value: string | undefined) => (value === undefined ? undefined : `"${value}"`);
const number = (value: number | undefined) => (value === undefined ? undefined : String(value));

/**
 * The theme values the panel compares, in the order a reader notices them, each
 * printed as the diff shows it. Every one changes something visible on the chart.
 */
const TRACKED: readonly { path: string; read: (mode: Mode) => string | undefined }[] = [
  { path: "darkMode", read: ({ dark }) => quoted(dark ? "force" : "off") },
  { path: "fonts.family", read: ({ theme }) => quoted(firstFamily(theme.fonts?.family)) },
  {
    path: "colors.background",
    read: ({ theme, dark }) => quoted(pick(colorsOf(theme).background, dark)),
  },
  {
    path: "chrome.eyebrow.color",
    read: ({ theme, dark }) => quoted(pick(theme.chrome?.eyebrow?.color, dark)),
  },
  {
    path: "rule",
    read: ({ theme, dark }) =>
      theme.rule ? `{ width: ${theme.rule.width}, color: "${pick(theme.rule.color, dark)}" }` : undefined,
  },
  {
    path: "colors.categorical",
    read: ({ theme }) => {
      const palette = colorsOf(theme).categorical;
      if (!palette) return undefined;
      return `[${palette
        .slice(0, 2)
        .map((color) => JSON.stringify(color))
        .join(", ")}, …]`;
    },
  },
  { path: "colors.text", read: ({ theme, dark }) => quoted(pick(colorsOf(theme).text, dark)) },
  { path: "colors.axis", read: ({ theme, dark }) => quoted(pick(colorsOf(theme).axis, dark)) },
  { path: "fonts.sizes.title", read: ({ theme }) => number(theme.fonts?.sizes?.title) },
  { path: "spacing.padding", read: ({ theme }) => number(theme.spacing?.padding) },
];

/** The library's own defaults, which the first stop's preset replaces. */
const LIBRARY_DEFAULT: Mode = { theme: DEFAULT_THEME as unknown as ThemeConfig, dark: false };

/** The tracked values that differ from `before` (the library default when absent), at most MAX_DIFF_LINES. */
export function themeDiff(before: Mode | undefined, after: Mode): ThemeDiffLine[] {
  const from = before ?? LIBRARY_DEFAULT;
  return TRACKED.flatMap(({ path, read }) => {
    const was = read(from);
    const now = read(after);
    if (was === now) return [];
    return [
      {
        path,
        ...(was === undefined ? {} : { before: was }),
        ...(now === undefined ? {} : { after: now }),
      },
    ];
  }).slice(0, MAX_DIFF_LINES);
}

/** Every stop's diff against the stop shown before it, so the list matches what changes on screen. */
export function houseStyleDiffs(stops: readonly HouseStyleStop[] = HOUSE_STYLE_STOPS) {
  return stops.map((stop, index) => themeDiff(stops[index - 1], stop));
}
