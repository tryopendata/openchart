/**
 * The landing page's words that more than one file needs: the headline, the lede,
 * the short lede and the eight section headings. Each section component takes its h2 from here, and
 * the build test checks the page against it, so a heading changes in one place.
 */

/** The landing sections' ids, in page order. Each is a `<section>` id and the prefix of its heading id. */
export const LANDING_SECTION_IDS = [
  "desk",
  "story",
  "motion",
  "styles",
  "responsive",
  "vocabulary",
  "agents",
  "start",
] as const;

/** One landing section id. */
export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number];

/** The shared landing copy. Headings are sentence case, with no kicker above them. */
export type LandingCopy = {
  /** The page's only h1, in the hero. */
  headline: string;
  /** The paragraph under the headline. */
  lede: string;
  /** A shorter lede, for where the full one does not fit. */
  ledeShort: string;
  /** Each section's h2, by section id. */
  headings: Record<LandingSectionId, string>;
};

/** The landing copy every section and the build test read. */
export const landingCopy: LandingCopy = {
  headline: "Charts, maps and tables that arrive ready to publish.",
  lede: "OpenChart draws the headline, source line, annotations, legend and responsive layout for you, in your house style, with motion built in. You describe the graphic in a short JSON spec, and it runs in React, Vue, Svelte or plain JavaScript.",
  ledeShort:
    "OpenChart draws the headline, source line, annotations and responsive layout for you, from a short JSON spec, in React, Vue, Svelte or plain JavaScript.",
  headings: {
    desk: "One dataset, four ways to tell the story",
    story: "Annotate the story as the reader scrolls",
    motion: "When the numbers change, the chart moves with them",
    styles: "One chart, set in four house styles",
    responsive: "The same graphic, from a phone to a full-width spread",
    vocabulary: "Twenty-four charts, and the maps and flows beside them",
    agents: "A coding agent can draw the chart, and the validator catches its mistakes",
    start: "Install it for React, Vue, Svelte or plain JavaScript",
  },
};
