/**
 * Frontmatter schemas for docs pages. Site MDX pages and the repository's
 * docs/*.md share one shape; repo docs may also set `slug`, since their file
 * names are fixed by the repository.
 */
import { z } from "astro/zod";
import { docsAreas } from "../config";

const sectionIds = docsAreas.flatMap((area) => area.sections.map((section) => section.id));

/** Frontmatter for a site page under src/content/docs/. */
export const docSchema = z.object({
  title: z.string().trim().min(1),
  /** Meta description, docs-home text and the llms.txt summary. */
  description: z.string().trim().min(1).max(160),
  /** The sidebar section, which also decides the area. */
  section: z.enum(sectionIds as [string, ...string[]], {
    error: `section must be one of: ${sectionIds.join(", ")}`,
  }),
  /** Position inside the section; ties sort by title. */
  order: z.number().default(100),
  /** Shorter label for the sidebar and pager. */
  sidebarLabel: z.string().trim().min(1).optional(),
});

/** Frontmatter for a published docs/*.md file: `slug` replaces the file name in the URL. */
export const repoDocSchema = docSchema.extend({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits and hyphens")
    .optional(),
});

/** Parsed frontmatter of a site page. */
export type DocData = z.infer<typeof docSchema>;
