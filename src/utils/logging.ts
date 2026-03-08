/**
 * Request logging utilities
 * Implements SCRUM-74: Request logging with trace IDs
 */

import { randomUUID } from "crypto";

export interface RequestLog {
  trace_id: string;
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;
  duration_ms: number;
  status: "success" | "error";
  error_code?: string;
  result_count?: number;
}

/**
 * Generate a unique trace ID for request tracking
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Create a request logger
 */
export function createRequestLogger() {
  const logs: RequestLog[] = [];
  
  return {
    /**
     * Log a request
     */
    log(entry: RequestLog): void {
      logs.push(entry);
      
      // Output to stderr for MCP server
      const logLine = JSON.stringify({
        level: entry.status === "error" ? "error" : "info",
        ...entry
      });
      console.error(logLine);
    },
    
    /**
     * Get recent logs
     */
    getRecentLogs(limit = 100): RequestLog[] {
      return logs.slice(-limit);
    },
    
    /**
     * Get logs by trace ID
     */
    getByTraceId(traceId: string): RequestLog | undefined {
      return logs.find(l => l.trace_id === traceId);
    }
  };
}

/**
 * Measure execution time
 */
export function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  return fn().then(result => ({
    result,
    durationMs: Date.now() - start
  }));
}

/**
 * Sanitize params for logging (remove sensitive data)
 */
export function sanitizeParamsForLogging(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Don't log potentially sensitive values
    if (key.toLowerCase().includes("token") || 
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("password")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 100) {
      sanitized[key] = value.substring(0, 100) + "...";
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Global logger instance
export const requestLogger = createRequestLogger();
