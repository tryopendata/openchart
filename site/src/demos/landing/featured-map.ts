/**
 * The landing page's featured symbol map: the docs page's `maps/symbol-color`
 * demo with a land fill that reads against the dark page. The library's dark
 * "no data" fill sits almost on the site's dark canvas, so the states vanish in
 * the dark theme. The docs page keeps its own demo unchanged; only the landing
 * figure sets the fill, through the spec's theme so light and dark each get one.
 */
import { coloredSymbolMap } from "../maps/symbol-map";
import { defineDemo } from "../types";

/**
 * The land fill as a light/dark pair. Light is the library's default neutral, so
 * the light map is unchanged. Dark clears the 1.25:1 contrast the landing test
 * asks of the land against `--color-canvas` (#0e0f10) with room to spare (about 1.46:1).
 */
const LAND_FILL = { light: "#f0f0f0", dark: "#2e3033" } as const;

/** The symbol map the landing page's vocabulary section features. */
export const featuredMap = defineDemo({
  ...coloredSymbolMap,
  id: "landing/featured-map",
  spec: {
    ...coloredSymbolMap.spec,
    theme: {
      ...coloredSymbolMap.spec.theme,
      colors: { ...coloredSymbolMap.spec.theme?.colors, mapNoDataFill: LAND_FILL },
    },
  },
});
