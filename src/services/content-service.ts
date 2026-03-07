import type { Article } from "../schemas/article.js";

/**
 * Content Service Interface
 * 
 * This interface defines the contract between the MCP server and the
 * backend content service. In production, this will call internal APIs.
 * For development/testing, use MockContentService.
 */
export interface ContentService {
  search(params: {
    query: string;
    section?: string;
    topic?: string;
    region?: string;
    from_date?: string;
    to_date?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }>;

  getArticle(idOrSlug: string): Promise<Article | null>;

  getLatest(params: {
    section?: string;
    region?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }>;

  getTopicNews(params: {
    topic: string;
    section?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }>;

  getRelated(idOrSlug: string, limit: number): Promise<Article[]>;
}

/**
 * Content service configuration
 */
export interface ContentServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}
