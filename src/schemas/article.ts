import { z } from "zod";

/**
 * Access level enum - determines what content is exposed
 */
export const AccessLevel = z.enum([
  "free",       // Publicly accessible
  "registered", // Requires free account
  "subscriber", // Paid subscription required
  "restricted"  // Cannot be served (wire copy, embargoed)
]);

export type AccessLevel = z.infer<typeof AccessLevel>;

/**
 * Content type enum
 */
export const ContentType = z.enum([
  "article",
  "liveblog",
  "guide",
  "analysis",
  "opinion",
  "review"
]);

export type ContentType = z.infer<typeof ContentType>;

/**
 * Article schema - 13 required fields per spec
 */
export const ArticleSchema = z.object({
  id: z.string().describe("Stable internal identifier"),
  slug: z.string().describe("Canonical web slug"),
  headline: z.string().describe("Editorial headline"),
  summary: z.string().nullable().describe("AI-generated summary (null for restricted)"),
  author: z.string().describe("Author display name"),
  section: z.string().describe("Editorial section"),
  topics: z.array(z.string()).describe("Normalized topic tags"),
  published_at: z.string().datetime().describe("ISO 8601 publish timestamp"),
  updated_at: z.string().datetime().describe("ISO 8601 last update timestamp"),
  canonical_url: z.string().url().describe("Canonical article URL"),
  access: AccessLevel.describe("Content access level"),
  source: z.string().describe("Content source (staff, AP, etc.)"),
  content_type: ContentType.describe("Type of content"),
  image_url: z.string().url().nullable().describe("Image URL (staff photos only)")
});

export type Article = z.infer<typeof ArticleSchema>;

/**
 * Paginated response wrapper
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    articles: z.array(itemSchema),
    next_cursor: z.string().nullable().describe("Opaque cursor for next page"),
    total_count: z.number().optional().describe("Total matching articles")
  });

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
