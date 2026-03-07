#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { MockContentService } from "./services/mock-content-service.js";
import {
  SearchArticlesParams,
  GetArticleParams,
  GetLatestNewsParams,
  GetTopicNewsParams,
  GetRelatedArticlesParams,
} from "./tools/definitions.js";
import type { ContentService } from "./services/content-service.js";

/**
 * Inquirer Content MCP Server
 * 
 * Provides structured access to Philadelphia Inquirer article metadata
 * for AI clients via the Model Context Protocol.
 */

const server = new Server(
  {
    name: "inquirer-content-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize content service (swap for real implementation in production)
const contentService: ContentService = new MockContentService();

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_articles",
        description: "Search articles by keyword with optional filters for section, topic, region, and date range",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string" },
            section: { type: "string", description: "Filter by section" },
            topic: { type: "string", description: "Filter by topic" },
            region: { type: "string", description: "Filter by region" },
            from_date: { type: "string", description: "Start date (ISO 8601)" },
            to_date: { type: "string", description: "End date (ISO 8601)" },
            limit: { type: "number", description: "Results per page (1-50)", default: 10 },
            cursor: { type: "string", description: "Pagination cursor" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_article",
        description: "Retrieve a single article by ID or slug",
        inputSchema: {
          type: "object",
          properties: {
            article_id_or_slug: { type: "string", description: "Article ID or canonical slug" }
          },
          required: ["article_id_or_slug"]
        }
      },
      {
        name: "get_latest_news",
        description: "Get the latest news articles, optionally filtered by section or region",
        inputSchema: {
          type: "object",
          properties: {
            section: { type: "string", description: "Filter by section" },
            region: { type: "string", description: "Filter by region" },
            limit: { type: "number", description: "Results per page (1-50)", default: 10 },
            cursor: { type: "string", description: "Pagination cursor" }
          }
        }
      },
      {
        name: "get_topic_news",
        description: "Get recent coverage for a specific topic",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Topic to search for" },
            section: { type: "string", description: "Filter by section" },
            limit: { type: "number", description: "Results per page (1-50)", default: 10 },
            cursor: { type: "string", description: "Pagination cursor" }
          },
          required: ["topic"]
        }
      },
      {
        name: "get_related_articles",
        description: "Get articles related to a given article",
        inputSchema: {
          type: "object",
          properties: {
            article_id_or_slug: { type: "string", description: "Article ID or slug" },
            limit: { type: "number", description: "Number of related articles (1-20)", default: 5 }
          },
          required: ["article_id_or_slug"]
        }
      }
    ]
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_articles": {
        const params = SearchArticlesParams.parse(args);
        const result = await contentService.search({
          query: params.query,
          section: params.section,
          topic: params.topic,
          region: params.region,
          from_date: params.from_date,
          to_date: params.to_date,
          limit: params.limit,
          cursor: params.cursor
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "get_article": {
        const params = GetArticleParams.parse(args);
        const article = await contentService.getArticle(params.article_id_or_slug);
        
        if (!article) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: {
                  code: "not_found",
                  message: `Article not found: ${params.article_id_or_slug}`
                }
              }, null, 2)
            }],
            isError: true
          };
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(article, null, 2) }]
        };
      }

      case "get_latest_news": {
        const params = GetLatestNewsParams.parse(args);
        const result = await contentService.getLatest({
          section: params.section,
          region: params.region,
          limit: params.limit,
          cursor: params.cursor
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "get_topic_news": {
        const params = GetTopicNewsParams.parse(args);
        const result = await contentService.getTopicNews({
          topic: params.topic,
          section: params.section,
          limit: params.limit,
          cursor: params.cursor
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "get_related_articles": {
        const params = GetRelatedArticlesParams.parse(args);
        const articles = await contentService.getRelated(
          params.article_id_or_slug,
          params.limit
        );
        return {
          content: [{ type: "text", text: JSON.stringify({ articles }, null, 2) }]
        };
      }

      default:
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: {
                code: "unknown_tool",
                message: `Unknown tool: ${name}`
              }
            }, null, 2)
          }],
          isError: true
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: {
            code: "internal_error",
            message
          }
        }, null, 2)
      }],
      isError: true
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Inquirer Content MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
