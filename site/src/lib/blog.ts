/**
 * The blog's derived values, kept apart from the pages that print them: a
 * post's reading time, its routes and dates, its tags and related docs links,
 * its BlogPosting JSON-LD and the RSS feed. Everything here is a pure function
 * of `BlogPost` values (from `allPosts()`), so the index, the article layout,
 * the tag pages and the feed all agree.
 */
import { type BlogTag, blogTags } from "../config";
import type { BlogPost } from "./blog-types";
import { escapeHtml } from "./demo/escape-html";

/** Reading speed for the "n min read" line, in words a minute. */
export const WORDS_PER_MINUTE = 230;

/**
 * What a reader reads in a post's source: code fences, import and export
 * lines, MDX comments and JSX or HTML tags removed. A `<Demo />` is a chart,
 * and a fence is either a chart or code, so neither counts as reading.
 */
function readableText(body: string): string {
  return body
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, " ")
    .replace(/^(?:import|export)\s.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ");
}

/** The words a reader reads in a post's Markdown or MDX body: prose only, without code, imports, comments or tags. */
export function wordCount(body: string): number {
  // A word holds a letter or a digit, so Markdown markers ("##", "-", "|") don't count.
  return readableText(body)
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Minutes to read a post's Markdown or MDX body at WORDS_PER_MINUTE, rounded up, at least 1. */
export function readingTime(body: string): number {
  return Math.max(1, Math.ceil(wordCount(body) / WORDS_PER_MINUTE));
}

/** A post's route, with its trailing slash. */
export const postPath = (slug: string) => `/blog/${slug}/`;

/** A tag page's route, with its trailing slash. */
export const tagPath = (tag: string) => `/blog/tags/${tag}/`;

/** A date as the `YYYY-MM-DD` a `<time datetime>` carries. Post dates are UTC midnights. */
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const DISPLAY_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** A date as a reader sees it: "November 20, 2026". */
export const displayDate = (date: Date) => DISPLAY_DATE.format(date);

/**
 * The tags a post carries, with their labels, in the order the post lists them.
 *
 * @throws {Error} Naming the id when `blogTags` has no such tag (the schema rejects one first).
 */
export function tagsOf(post: Pick<BlogPost, "tags">): BlogTag[] {
  return post.tags.map((id) => {
    const tag = blogTags.find((candidate) => candidate.id === id);
    if (!tag) throw new Error(`Tag "${id}" is not in blogTags in src/config.ts.`);
    return tag;
  });
}

/** Whether `post` carries the tag `tag`. */
export const carriesTag = (post: Pick<BlogPost, "tags">, tag: string) =>
  (post.tags as readonly string[]).includes(tag);

/** The posts that carry `tag`, in the order given. */
export function postsByTag<T extends Pick<BlogPost, "tags">>(
  posts: readonly T[],
  tag: string,
): T[] {
  return posts.filter((post) => carriesTag(post, tag));
}

/** The tags at least one post carries, in `blogTags` order: one tag page each. */
export function tagsInUse(posts: readonly Pick<BlogPost, "tags">[]): BlogTag[] {
  return blogTags.filter((tag) => posts.some((post) => carriesTag(post, tag.id)));
}

/** A docs page as the related list needs it. */
export type RelatedPage = { id: string; title: string };

/** A link in a post's "Related docs" list. */
export type RelatedLink = { title: string; href: string };

/**
 * A post's related docs ids as links, in the order the post lists them.
 *
 * @throws {Error} Naming the id when no page has it (`allPosts()` checks this first, so a hit means the page list passed in is incomplete).
 */
export function relatedLinks(ids: readonly string[], pages: readonly RelatedPage[]): RelatedLink[] {
  return ids.map((id) => {
    const page = pages.find((candidate) => candidate.id === id);
    if (!page) {
      throw new Error(`Related docs page "${id}" is not among the ${pages.length} pages given.`);
    }
    return { title: page.title, href: `/docs/${id}/` };
  });
}

/** Where a post lives and who publishes it, as its JSON-LD names them. */
export type ArticleLinks = {
  /** The post's absolute canonical URL. */
  canonical: string;
  /** The post's absolute social card URL. */
  image: string;
  publisher: { name: string; url: string };
};

/** The size of every social card, as the card route (`src/pages/og/[...slug].png.ts`) draws it. */
const SOCIAL_CARD_SIZE = { width: 1200, height: 630 };

/** The language every post is written in, as a BCP 47 tag. */
const POST_LANGUAGE = "en";

/**
 * The post's BlogPosting JSON-LD, ready to sit inside a `<script>`: every `<`
 * is written as `\u003c`, so a title holding `</script>` can't close the tag.
 * Dates are calendar days (`YYYY-MM-DD`), as the frontmatter gives them. An
 * author who is the publisher is an Organization with the publisher's URL,
 * anyone else a Person. The first tag names the section, and `words` is the
 * body's `wordCount`.
 */
export function articleJsonLd(post: BlogPost, links: ArticleLinks, words: number): string {
  const author =
    post.author === links.publisher.name
      ? { "@type": "Organization", name: post.author, url: links.publisher.url }
      : { "@type": "Person", name: post.author };
  const tags = tagsOf(post);
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: isoDay(post.published),
    dateModified: isoDay(lastModified(post)),
    author,
    publisher: { "@type": "Organization", name: links.publisher.name, url: links.publisher.url },
    image: { "@type": "ImageObject", url: links.image, ...SOCIAL_CARD_SIZE },
    mainEntityOfPage: { "@type": "WebPage", "@id": links.canonical },
    keywords: tags.map((tag) => tag.label),
    articleSection: tags[0]?.label,
    wordCount: words,
    inLanguage: POST_LANGUAGE,
  };
  return scriptSafeJson(data);
}

/**
 * The post's BreadcrumbList JSON-LD (Blog, then the post), escaped for a
 * `<script>` like `articleJsonLd`.
 */
export function breadcrumbJsonLd(post: Pick<BlogPost, "title">, links: BreadcrumbLinks): string {
  const crumbs = [
    { name: "Blog", item: links.blog },
    { name: post.title, item: links.canonical },
  ];
  return scriptSafeJson({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      ...crumb,
    })),
  });
}

/** The absolute URLs a post's breadcrumb trail runs through. */
export type BreadcrumbLinks = {
  /** The blog index's absolute URL. */
  blog: string;
  /** The post's absolute canonical URL. */
  canonical: string;
};

/** JSON for inside a `<script>`: every `<` as `\\u003c`, so a value holding `</script>` can't close the tag. */
const scriptSafeJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** When a post last changed: its `updated` date, else its `published` one. */
export const lastModified = (post: Pick<BlogPost, "published" | "updated">) =>
  post.updated ?? post.published;

/**
 * A post date as RSS 2.0's RFC 822 form, at noon GMT: "Fri, 20 Nov 2026 12:00:00 GMT".
 * Post dates are calendar days, and noon keeps the day the same for readers in
 * any time zone from UTC-12 to UTC+11, where midnight would show the day before
 * west of Greenwich.
 */
export function rssDate(date: Date): string {
  const noon = new Date(`${isoDay(date)}T12:00:00Z`);
  return noon.toUTCString();
}

/** The feed's own fields. */
export type FeedChannel = {
  title: string;
  description: string;
  /** Absolute URL of the blog index. */
  link: string;
  /** Absolute URL of the feed itself, for `atom:link rel="self"`. */
  feedUrl: string;
};

/** One `<item>`: title, canonical link and guid, RFC 822 date, description and a category per tag. */
function rssItem(post: BlogPost, channel: FeedChannel): string {
  const link = escapeHtml(new URL(postPath(post.slug), channel.link).href);
  const categories = tagsOf(post).map((tag) => `<category>${escapeHtml(tag.label)}</category>`);
  return [
    "<item>",
    `<title>${escapeHtml(post.title)}</title>`,
    `<link>${link}</link>`,
    `<guid isPermaLink="true">${link}</guid>`,
    `<pubDate>${rssDate(post.published)}</pubDate>`,
    `<description>${escapeHtml(post.description)}</description>`,
    ...categories,
    "</item>",
  ].join("");
}

/**
 * The RSS 2.0 feed for `posts`, newest first, with an `atom:link rel="self"`
 * to `channel.feedUrl`. Its lastBuildDate is the latest day any post was
 * published or updated.
 */
export function rssXml(posts: readonly BlogPost[], channel: FeedChannel): string {
  const newestFirst = [...posts].sort((a, b) => b.published.getTime() - a.published.getTime());
  const lastChange = newestFirst
    .map(lastModified)
    .reduce<Date | undefined>(
      (latest, date) => (latest && latest >= date ? latest : date),
      undefined,
    );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${escapeHtml(channel.title)}</title>`,
    `<link>${escapeHtml(channel.link)}</link>`,
    `<description>${escapeHtml(channel.description)}</description>`,
    "<language>en-us</language>",
    `<atom:link href="${escapeHtml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    lastChange ? `<lastBuildDate>${rssDate(lastChange)}</lastBuildDate>` : "",
    ...newestFirst.map((post) => rssItem(post, channel)),
    "</channel></rss>",
  ].join("");
}
