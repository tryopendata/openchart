/**
 * The house-style section's stops and the theme lines each one changes. The
 * chart moves through the library's four presets and then into dark mode; at
 * each stop the section shows the handful of theme values a reader would notice
 * changing, as a diff (see `houseStyleDiffs`). Pure data, computed at build time.
 */
import { broadsheet, essay, type ThemeConfig, terminal, wire } from "@opendata-ai/openchart-core";

/** The presets in scrub order, by the name the library exports them under. */
export const PRESET_NAMES = ["essay", "wire", "broadsheet", "terminal"] as const;

/** One stop on the scrub. */
export type HouseStyleStop = {
  id: (typeof PRESET_NAMES)[number] | "dark";
  /** The button text and the name shown over the chart. */
  label: string;
  /** The preset the chart wears at this stop. */
  preset: (typeof PRESET_NAMES)[number];
  theme: ThemeConfig;
  /** Render in dark mode (`darkMode: "force"`); otherwise the preset's light values. */
  dark: boolean;
};

export const HOUSE_STYLE_STOPS: readonly HouseStyleStop[] = [
  { id: "essay", label: "Essay", preset: "essay", theme: essay, dark: false },
  { id: "wire", label: "Wire", preset: "wire", theme: wire, dark: false },
  { id: "broadsheet", label: "Broadsheet", preset: "broadsheet", theme: broadsheet, dark: false },
  { id: "terminal", label: "Terminal", preset: "terminal", theme: terminal, dark: false },
  // The last stop keeps broadsheet and flips the mode: the library derives the dark values.
  { id: "dark", label: "Dark mode", preset: "broadsheet", theme: broadsheet, dark: true },
];

/** One changed value: its path in the theme, and the printed value before and after (absent when unset). */
export type ThemeDiffLine = { path: string; before?: string; after?: string };

type Mode = { theme: ThemeConfig; dark: boolean };
type ModeValue = string | { light: string; dark: string } | undefined;

const pick = (value: ModeValue, dark: boolean) =>
  typeof value === "object" ? (dark ? value.dark : value.light) : value;

/** The first family in a font stack, without quotes: what a reader recognises. */
const firstFamily = (stack: string | undefined) => stack?.split(",")[0]?.trim().replace(/"/g, "");

type ThemeColors = Exclude<NonNullable<ThemeConfig["colors"]>, readonly unknown[]>;

/** A theme's colors as an object: a bare array is shorthand for the categorical palette. */
const colorsOf = (theme: ThemeConfig): ThemeColors =>
  Array.isArray(theme.colors) ? { categorical: theme.colors } : (theme.colors ?? {});

const quoted = (value: string | undefined) => (value === undefined ? undefined : `"${value}"`);
const number = (value: number | undefined) => (value === undefined ? undefined : String(value));

/**
 * The theme values the section compares, each printed the way the diff shows it.
 * The full presets set more; these are the ones that change how the chart reads.
 */
const TRACKED: readonly { path: string; read: (mode: Mode) => string | undefined }[] = [
  { path: "darkMode", read: ({ dark }) => quoted(dark ? "force" : "off") },
  { path: "fonts.family", read: ({ theme }) => quoted(firstFamily(theme.fonts?.family)) },
  { path: "fonts.sizes.title", read: ({ theme }) => number(theme.fonts?.sizes?.title) },
  {
    path: "colors.background",
    read: ({ theme, dark }) => quoted(pick(colorsOf(theme).background as ModeValue, dark)),
  },
  {
    path: "colors.text",
    read: ({ theme, dark }) => quoted(pick(colorsOf(theme).text as ModeValue, dark)),
  },
  {
    path: "colors.categorical",
    read: ({ theme }) => {
      const palette = colorsOf(theme).categorical;
      if (!palette) return undefined;
      const shown = palette.slice(0, 3).map((color) => JSON.stringify(color));
      return `[${shown.join(", ")}, …]`;
    },
  },
  { path: "spacing.padding", read: ({ theme }) => number(theme.spacing?.padding) },
  {
    path: "rule",
    read: ({ theme, dark }) =>
      theme.rule
        ? `{ width: ${theme.rule.width}, color: "${pick(theme.rule.color as ModeValue, dark)}" }`
        : undefined,
  },
  { path: "borderRadius", read: ({ theme }) => number(theme.borderRadius) },
  { path: "seriesStrategy", read: ({ theme }) => quoted(theme.seriesStrategy) },
];

/** The site's own chart theme in light mode: what the first stop is compared with. */
const SITE_DEFAULT: Mode = { theme: {}, dark: false };

/** The tracked values that differ between the stop before (or the site default) and this one. */
export function themeDiff(before: Mode | undefined, after: Mode): ThemeDiffLine[] {
  const from = before ?? SITE_DEFAULT;
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
  });
}

/**
 * Every stop's diff. A preset stop compares with the stop before it; the dark
 * stop compares with the same preset in light, so it shows only what dark mode changes.
 */
export function houseStyleDiffs(stops: readonly HouseStyleStop[] = HOUSE_STYLE_STOPS) {
  return stops.map((stop, index) => {
    const sameInLight = stop.dark
      ? stops.find((other) => other.preset === stop.preset && !other.dark)
      : undefined;
    return themeDiff(sameInLight ?? stops[index - 1], stop);
  });
}
