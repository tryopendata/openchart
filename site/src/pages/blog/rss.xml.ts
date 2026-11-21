/**
 * The blog's RSS 2.0 feed at /blog/rss.xml: one item per published post,
 * newest first, written by `rssXml()` in lib/blog.ts.
 */
import type { APIRoute } from "astro";
import { site } from "../../config";
import { rssXml } from "../../lib/blog";
import { allPosts } from "../../lib/collection";

export const GET: APIRoute = async () => {
  const posts = (await allPosts()).map(({ post }) => post);
  const xml = rssXml(posts, {
    title: `${site.name} blog`,
    description: "Articles on choosing, labelling and building charts for news.",
    link: new URL("/blog/", site.url).href,
    feedUrl: new URL("/blog/rss.xml", site.url).href,
  });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
