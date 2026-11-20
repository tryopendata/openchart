/**
 * The Shiki themes for every highlighted code block on the site, Markdown fences
 * and demo code tabs alike. Both clear AA contrast for every token on the page
 * background; global.css picks one per site theme.
 */
export const shikiThemes = {
  light: "github-light-high-contrast",
  dark: "github-dark-default",
} as const;
