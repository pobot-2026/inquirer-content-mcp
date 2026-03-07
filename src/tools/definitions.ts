import { z } from "zod";

/**
 * Tool parameter schemas for MCP tools
 */

export const SearchArticlesParams = z.object({
  query: z.string().describe("Search query string"),
  section: z.string().optional().describe("Filter by section"),
  topic: z.string().optional().describe("Filter by topic"),
  region: z.string().optional().describe("Filter by region"),
  from_date: z.string().datetime().optional().describe("Start date (ISO 8601)"),
  to_date: z.string().datetime().optional().describe("End date (ISO 8601)"),
  limit: z.number().int().min(1).max(50).default(10).describe("Results per page"),
  cursor: z.string().optional().describe("Pagination cursor")
});

export const GetArticleParams = z.object({
  article_id_or_slug: z.string().describe("Article ID or canonical slug")
});

export const GetLatestNewsParams = z.object({
  section: z.string().optional().describe("Filter by section"),
  region: z.string().optional().describe("Filter by region"),
  limit: z.number().int().min(1).max(50).default(10).describe("Results per page"),
  cursor: z.string().optional().describe("Pagination cursor")
});

export const GetTopicNewsParams = z.object({
  topic: z.string().describe("Topic to search for"),
  section: z.string().optional().describe("Filter by section"),
  limit: z.number().int().min(1).max(50).default(10).describe("Results per page"),
  cursor: z.string().optional().describe("Pagination cursor")
});

export const GetRelatedArticlesParams = z.object({
  article_id_or_slug: z.string().describe("Article ID or slug to find related content for"),
  limit: z.number().int().min(1).max(20).default(5).describe("Number of related articles")
});

/**
 * MCP Tool definitions
 */
export const toolDefinitions = [
  {
    name: "search_articles",
    description: "Search articles by keyword with optional filters for section, topic, region, and date range",
    inputSchema: SearchArticlesParams
  },
  {
    name: "get_article",
    description: "Retrieve a single article by ID or slug",
    inputSchema: GetArticleParams
  },
  {
    name: "get_latest_news",
    description: "Get the latest news articles, optionally filtered by section or region",
    inputSchema: GetLatestNewsParams
  },
  {
    name: "get_topic_news",
    description: "Get recent coverage for a specific topic",
    inputSchema: GetTopicNewsParams
  },
  {
    name: "get_related_articles",
    description: "Get articles related to a given article",
    inputSchema: GetRelatedArticlesParams
  }
] as const;
