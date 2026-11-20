/**
 * The site's self-hosted fonts. Importing this module from the layout brings in the
 * @font-face rules (Vite bundles the files with hashed names), and `preloadFonts`
 * lists the files worth fetching before the CSS is parsed. global.css names the
 * families in `--font-sans` and `--font-mono`.
 */

import "@fontsource-variable/schibsted-grotesk/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/400-italic.css";
import sansLatin from "@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2?url";

/** WOFF2 URLs to preload: the Latin subset of the variable sans, used by every page above the fold. */
export const preloadFonts: readonly string[] = [sansLatin];
