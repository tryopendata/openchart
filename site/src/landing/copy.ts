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
  "story",
  "motion",
  "kinds",
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
  headline: "Write a chart as JSON. Get one ready to publish.",
  lede: "OpenChart turns a declarative spec into a finished chart, table, network or map, with the title, source line, annotations and responsive layout handled for you. Render it with React, Vue, Svelte or plain JavaScript, and let a coding agent write the spec.",
  headings: {
    desk: "Each line of the spec is a change you can see",
    vocabulary: "Find the chart by what it has to show",
    styles: "Change the house style without touching the chart",
    story: "Ranges, callouts and highlights are fields in the spec",
    motion: "When the data changes, the marks move to the new values",
    kinds: "Tables, networks and maps take the same kind of spec",
    responsive: "One spec lays itself out from phone width to full width",
    agents: "Agents write the spec, and the validator tells them what to fix",
    frameworks: "React, Vue, Svelte or no framework, from the same spec",
    closing: "Accessible, exportable and Apache-2.0 licensed",
  },
};
