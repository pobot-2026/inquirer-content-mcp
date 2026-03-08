#!/usr/bin/env node
/**
 * Local Development HTTP Server
 * 
 * Exposes MCP tools as REST endpoints for local testing and POC demos.
 * This simulates what API Gateway + Lambda would do in production.
 * 
 * Usage: npm run dev:server
 * 
 * Endpoints:
 *   GET  /health
 *   POST /search          - search_articles
 *   GET  /articles/:id    - get_article
 *   GET  /latest          - get_latest_news
 *   GET  /topics/:topic   - get_topic_news
 *   GET  /related/:id     - get_related_articles
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { MockContentService } from "./services/mock-content-service.js";
import { createArcContentService } from "./services/arc-content-service.js";
import type { ContentService } from "./services/content-service.js";
import { generateTraceId, requestLogger, sanitizeParamsForLogging } from "./utils/logging.js";
import { ValidationError } from "./utils/validation.js";

const PORT = process.env.PORT || 3000;

// Initialize content service
function initContentService(): ContentService {
  if (process.env.PMN_SANDBOX_CONTENT_API) {
    console.log("🔌 Using Arc XP Content API");
    return createArcContentService();
  }
  console.log("🎭 Using Mock Content Service");
  return new MockContentService();
}

const contentService = initContentService();

/**
 * Parse JSON body from request
 */
async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Parse query params from URL
 */
function parseQuery(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 */
function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } });
}

/**
 * Request handler
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const traceId = generateTraceId();
  const startTime = Date.now();
  
  // Add trace ID to response headers
  res.setHeader("X-Trace-ID", traceId);
  
  try {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const method = req.method || "GET";
    const path = url.pathname;
    
    // Handle CORS preflight
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      res.end();
      return;
    }
    
    // Route handling
    let result: unknown;
    let toolName = "unknown";
    let params: Record<string, unknown> = {};
    
    // Health check
    if (path === "/health") {
      sendJson(res, 200, { 
        status: "ok", 
        service: "inquirer-content-mcp",
        version: "0.1.0",
        backend: process.env.PMN_SANDBOX_CONTENT_API ? "arc" : "mock"
      });
      return;
    }
    
    // POST /search - search_articles
    if (method === "POST" && path === "/search") {
      toolName = "search_articles";
      const body = await parseBody(req);
      params = {
        query: body.query as string || "",
        section: body.section,
        topic: body.topic,
        region: body.region,
        from_date: body.from_date,
        to_date: body.to_date,
        limit: Number(body.limit) || 10,
        cursor: body.cursor
      };
      
      result = await contentService.search({
        query: params.query as string,
        section: params.section as string | undefined,
        topic: params.topic as string | undefined,
        region: params.region as string | undefined,
        from_date: params.from_date as string | undefined,
        to_date: params.to_date as string | undefined,
        limit: params.limit as number,
        cursor: params.cursor as string | undefined
      });
    }
    
    // GET /articles/:id - get_article
    else if (method === "GET" && path.startsWith("/articles/")) {
      toolName = "get_article";
      const articleId = decodeURIComponent(path.replace("/articles/", ""));
      params = { article_id_or_slug: articleId };
      
      const article = await contentService.getArticle(articleId);
      if (!article) {
        requestLogger.log({
          trace_id: traceId,
          timestamp: new Date().toISOString(),
          tool: toolName,
          params: sanitizeParamsForLogging(params),
          duration_ms: Date.now() - startTime,
          status: "error",
          error_code: "not_found"
        });
        sendError(res, 404, "not_found", `Article not found: ${articleId}`);
        return;
      }
      result = article;
    }
    
    // GET /latest - get_latest_news
    else if (method === "GET" && path === "/latest") {
      toolName = "get_latest_news";
      const query = parseQuery(url);
      params = {
        section: query.section,
        region: query.region,
        limit: Number(query.limit) || 10,
        cursor: query.cursor
      };
      
      result = await contentService.getLatest({
        section: params.section as string | undefined,
        region: params.region as string | undefined,
        limit: params.limit as number,
        cursor: params.cursor as string | undefined
      });
    }
    
    // GET /topics/:topic - get_topic_news
    else if (method === "GET" && path.startsWith("/topics/")) {
      toolName = "get_topic_news";
      const topic = decodeURIComponent(path.replace("/topics/", ""));
      const query = parseQuery(url);
      params = {
        topic,
        section: query.section,
        limit: Number(query.limit) || 10,
        cursor: query.cursor
      };
      
      result = await contentService.getTopicNews({
        topic: params.topic as string,
        section: params.section as string | undefined,
        limit: params.limit as number,
        cursor: params.cursor as string | undefined
      });
    }
    
    // GET /related/:id - get_related_articles
    else if (method === "GET" && path.startsWith("/related/")) {
      toolName = "get_related_articles";
      const articleId = decodeURIComponent(path.replace("/related/", ""));
      const query = parseQuery(url);
      params = {
        article_id_or_slug: articleId,
        limit: Number(query.limit) || 5
      };
      
      const articles = await contentService.getRelated(articleId, params.limit as number);
      result = { articles };
    }
    
    // 404 for unknown routes
    else {
      sendError(res, 404, "not_found", `Unknown endpoint: ${method} ${path}`);
      return;
    }
    
    // Log successful request
    const durationMs = Date.now() - startTime;
    requestLogger.log({
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      tool: toolName,
      params: sanitizeParamsForLogging(params),
      duration_ms: durationMs,
      status: "success",
      result_count: Array.isArray(result) ? result.length : 
                    (result as { articles?: unknown[] })?.articles?.length
    });
    
    sendJson(res, 200, result);
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = error instanceof ValidationError ? "validation_error" : "internal_error";
    
    requestLogger.log({
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      tool: "unknown",
      params: {},
      duration_ms: durationMs,
      status: "error",
      error_code: code
    });
    
    console.error(`[${traceId}] Error:`, error);
    sendError(res, code === "validation_error" ? 400 : 500, code, message);
  }
}

// Create and start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Inquirer Content MCP - Local Dev Server              ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}                      ║
║                                                              ║
║  Endpoints:                                                  ║
║    GET  /health              - Health check                  ║
║    POST /search              - Search articles               ║
║    GET  /articles/:id        - Get article by ID/slug        ║
║    GET  /latest              - Get latest news               ║
║    GET  /topics/:topic       - Get topic news                ║
║    GET  /related/:id         - Get related articles          ║
║                                                              ║
║  Press Ctrl+C to stop                                        ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
