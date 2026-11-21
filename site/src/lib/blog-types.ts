/**
 * The blog's data contract, shared by the content pipeline (`allPosts()` in
 * collection.ts), which produces these values, and the blog pages, layout,
 * RSS feed and social cards, which render them.
 */
import type { BlogTagId } from "../config";

/** A published blog post, whatever file it came from. */
export type BlogPost = {
  /** The file name without its extension, which is also the path under /blog/. */
  slug: string;
  title: string;
  description: string;
  published: Date;
  updated?: Date;
  author: string;
  /** One to four tag ids from `blogTags`, in the order the post lists them. */
  tags: BlogTagId[];
  /** One to four docs page ids ("<section>/<slug>"), each an existing page. */
  related: string[];
  /** The demo id the blog index shows as the post's chart. */
  lead?: string;
};
