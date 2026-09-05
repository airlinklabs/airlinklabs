import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const docsCollection = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.string(),
    order: z.number(),
    author: z.string().optional(),
    date: z.date().optional(),
  }),
});

const blogCollection = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
    authorGithub: z.string().optional(),
    pinned: z.boolean().optional(),
  }),
});

export const collections = {
  docs: docsCollection,
  blog: blogCollection,
};
