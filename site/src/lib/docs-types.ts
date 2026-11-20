/**
 * The docs data contract shared by the content pipeline, which produces these
 * values, and the docs layout, which renders them. Neither side defines its own.
 */

export type AreaId = "guides" | "visualizations" | "building-blocks" | "reference";

/** One sidebar section inside an area. */
export type DocsSection = { readonly id: string; readonly label: string };

/** One top-level docs area and its sections, in display order. */
export type DocsArea = {
  readonly id: AreaId;
  readonly label: string;
  readonly sections: readonly DocsSection[];
};

/** A published docs page, whatever file it came from. */
export type DocPage = {
  /** "<section>/<slug>", which is also the path under /docs/. */
  id: string;
  area: AreaId;
  section: string;
  title: string;
  description: string;
  order: number;
  sidebarLabel?: string;
  source: "repo-md" | "site-mdx";
};

/** A heading in the page outline. */
export type Heading = { depth: 2 | 3; slug: string; text: string };

/** A link to a docs page. */
export type NavItem = { id: string; label: string; href: string };

/** A sidebar section with its pages in order. */
export type NavSection = { id: string; label: string; items: NavItem[] };

/** An area in the area switcher; `href` is its first page. */
export type NavArea = { id: AreaId; label: string; href: string; sections: NavSection[] };

/** Everything DocsLayout needs to render one docs page. */
export type DocsLayoutProps = {
  /** `path` is the route with its trailing slash; `markdown` is the page's .md export URL. */
  page: DocPage & { path: string; markdown: string };
  /** Every area that has pages, for the area switcher. */
  areas: NavArea[];
  /** The current area's sections, for the sidebar. */
  nav: NavSection[];
  outline: Heading[];
  prev?: NavItem | undefined;
  next?: NavItem | undefined;
};
