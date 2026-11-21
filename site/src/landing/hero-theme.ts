/**
 * The theme the hero chart mounts with, live and static: the site's fonts and
 * nothing else. The engine lays a mount theme over the spec's own, so the
 * site's usual colors would hide the broadsheet preset the desk's last step
 * adds. The library's defaults (a transparent background, its own ink, dark
 * variants under `darkMode: "force"`) already suit the page in both themes.
 * Kept apart from hero.ts so the island imports no dataset or preset.
 */
import type { ThemeConfig } from "@opendata-ai/openchart-core";
import { chartTheme } from "../lib/demo/chart-theme";

export const heroChartTheme: ThemeConfig = { fonts: chartTheme(false).fonts };
