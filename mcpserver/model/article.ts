import { z } from "zod";

export const ArticleSchema = z.object({
  id: z.string(),
  source: z.string(),
  url: z.string().url(),
  publishedDate: z.string().datetime().optional(),
  author: z.string().optional(),
  title: z.string(),
  text: z.string(),
  summary: z.string(),
});

export type Article = z.infer<typeof ArticleSchema>;
