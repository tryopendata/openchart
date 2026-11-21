/**
 * The landing page's words that more than one file needs: the headline, the lede
 * and the ten section headings. Each section component takes its h2 from here, and
 * the build test checks the page against it, so a heading changes in one place.
 */

/** The landing sections' ids, in page order. Each is a `<section>` id and the prefix of its heading id. */
export const LANDING_SECTION_IDS = [
  "desk",
  "vocabulary",
  "styles",
  "kinds",
  "story",
  "motion",
  "responsive",
  "agents",
  "frameworks",
  "closing",
] as const;

/** One landing section id. */
export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number];

/** The shared landing copy. Headings are sentence case, with no kicker above them. */
export type LandingCopy = {
  /** The page's only h1, in the hero. */
  headline: string;
  /** The paragraph under the headline. */
  lede: string;
  /** Each section's h2, by section id. */
  headings: Record<LandingSectionId, string>;
};

export const landingCopy: LandingCopy = {
  headline: "Charts, maps and tables that arrive ready to publish.",
  lede: "OpenChart draws the headline, source line, annotations, legend and responsive layout for you, in your house style, with motion built in. You describe the graphic in a short JSON spec, and it runs in React, Vue, Svelte or plain JavaScript.",
  headings: {
    desk: "One dataset, four ways to tell the story",
    vocabulary: "Find the chart by what it has to show",
    styles: "One chart, set in four house styles",
    kinds: "Tables, networks and maps in the same house style",
    story: "Annotate the story as the reader scrolls",
    motion: "When the numbers change, the chart moves with them",
    responsive: "The same graphic, from a phone to a full-width spread",
    agents: "A coding agent can draw the chart, and the validator catches its mistakes",
    frameworks: "Works in React, Vue, Svelte or plain JavaScript",
    closing: "Accessible, exportable and Apache-2.0 licensed",
  },
};
