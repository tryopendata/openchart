/**
 * What a blog post adds to a demo figure: the credit line's target (the docs
 * page for the figure's chart type) and the width its static SVGs lay out at,
 * the article's wide column. Demo.astro and the `json demo` fence decide whether
 * the page is a post and pass the result to `demoFigureHtml`; docs pages pass
 * nothing and their figures are unchanged. Pure: no I/O.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** Where a figure's "Made with OpenChart" line links, and what it calls the chart. */
export type FigureCredit = {
  /** A docs page route with its trailing slash, such as "/docs/change-over-time/line/". */
  href: string;
  /** The chart type in lowercase prose, such as "line chart". */
  chartName: string;
};

/** The blog-only parts of a demo figure. */
export type BlogFigure = { credit: FigureCredit; staticWidth: number };

/** The article's wide column in px, which blog figures' static SVGs lay out at. */
export const BLOG_FIGURE_WIDTH = 1024;

/** Thrown when a blog figure's spec has no docs page to credit. The message names the demo. */
export class UnknownFigureCreditError extends Error {}

/**
 * The docs page that shows how to build this figure's chart type.
 *
 * @throws {UnknownFigureCreditError} When the spec's type or mark has no credit target.
 */
export function figureCredit(_id: string, _spec: VizSpec): FigureCredit {
  throw new Error("not implemented");
}

/**
 * The blog-only options for one figure: its credit and the wide static width.
 *
 * @throws {UnknownFigureCreditError} When the spec's type or mark has no credit target.
 */
export function blogFigure(_id: string, _spec: VizSpec): BlogFigure {
  throw new Error("not implemented");
}

/** Whether a route is a blog post ("/blog/<slug>/"), not the index or a tag page. */
export function isBlogPostPath(_pathname: string): boolean {
  throw new Error("not implemented");
}

/** Whether a content file is a blog post, a file under `src/content/blog/`. */
export function isBlogPostFile(_fileURL: URL | string | undefined): boolean {
  throw new Error("not implemented");
}
