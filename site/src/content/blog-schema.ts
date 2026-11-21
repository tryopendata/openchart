/**
 * Frontmatter schema for blog posts under src/content/blog/. Whether each
 * `related` id names an existing docs page is checked in `allPosts()`, since
 * the schema cannot see the pages.
 */
import { z } from "astro/zod";
import { blogTags } from "../config";

const tagIds = blogTags.map((tag) => tag.id);

/** A docs page id, "<section>/<slug>". */
const pageId = z
  .string()
  .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'related ids are docs page ids, "<section>/<slug>"');

/** Frontmatter for a blog post. */
export const blogSchema = z
  .object({
    title: z.string().trim().min(1).max(70),
    /** Meta description, the index summary, the RSS description and the social card text. */
    description: z.string().trim().min(1).max(160),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().trim().min(1),
    tags: z
      .array(
        z.enum(tagIds, {
          error: `tags must come from blogTags in src/config.ts: ${tagIds.join(", ")}`,
        }),
      )
      .min(1)
      .max(4),
    related: z.array(pageId).min(1).max(4),
    /** A demo id: the chart the blog index shows for the post. */
    lead: z.string().trim().min(1).optional(),
    draft: z.boolean().default(false),
  })
  .refine((post) => !post.updated || post.updated >= post.published, {
    message: "updated must not be before published",
    path: ["updated"],
  });

/** Parsed frontmatter of a blog post. */
export type BlogData = z.infer<typeof blogSchema>;
