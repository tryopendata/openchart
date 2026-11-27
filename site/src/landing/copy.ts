/**
 * The landing page's words that more than one file needs: the headline, the lede,
 * the short lede and the ten section headings. Each section component takes its h2 from here, and
 * the build test checks the page against it, so a heading changes in one place.
 */

/** The landing sections' ids, in page order. Each is a `<section>` id and the prefix of its heading id. */
export const LANDING_SECTION_IDS = [
  "desk",
  "edit",
  "story",
  "motion",
  "styles",
  "responsive",
  "publish",
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
  headline: "Publish-ready charts, maps and tables from JSON.",
  lede: "OpenChart draws the headline, source line, annotations, legend and a responsive layout for you, in your house style and with animation. It runs in React, Vue, Svelte or plain JavaScript.",
  ledeShort:
    "OpenChart draws the headline, source line, annotations and responsive layout for you, in React, Vue, Svelte or plain JavaScript.",
  headings: {
    desk: "Show the same data in four forms",
    edit: "Drag a callout to reposition it",
    story: "Update the chart as the reader scrolls",
    motion: "Animate the chart when the data changes",
    styles: "Use a built-in theme or define your own",
    responsive: "Resize the chart from phone to full width",
    publish: "Export the chart and its screen-reader text",
    vocabulary: "Browse the chart types by purpose",
    agents: "Use a coding agent to write specs",
    start: "Install it for React, Vue, Svelte or plain JavaScript",
  },
};
