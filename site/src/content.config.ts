import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docSchema } from "./content/schema";

export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
    schema: docSchema,
  }),
};
