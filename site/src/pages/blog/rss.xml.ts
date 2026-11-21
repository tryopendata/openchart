/**
 * The blog's RSS 2.0 feed at /blog/rss.xml: one item per published post,
 * newest first. Stub until lane d writes the feed through a tested `rssXml()`
 * with categories and an atom:link.
 */
import type { APIRoute } from "astro";
import { site } from "../../config";
import { allPosts } from "../../lib/collection";
import { escapeHtml } from "../../lib/demo/escape-html";

export const GET: APIRoute = async () => {
  const posts = await allPosts();
  const items = posts.map(({ post }) => {
    const link = new URL(`/blog/${post.slug}/`, site.url).href;
    return [
      "<item>",
      `<title>${escapeHtml(post.title)}</title>`,
      `<link>${link}</link>`,
      `<guid>${link}</guid>`,
      `<pubDate>${post.published.toUTCString()}</pubDate>`,
      `<description>${escapeHtml(post.description)}</description>`,
      "</item>",
    ].join("");
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"><channel>',
    `<title>${escapeHtml(site.name)} blog</title>`,
    `<link>${new URL("/blog/", site.url).href}</link>`,
    `<description>${escapeHtml(site.tagline)}</description>`,
    ...items,
    "</channel></rss>",
  ].join("");
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
