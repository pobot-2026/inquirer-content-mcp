import { z } from "zod";

/**
 * Input validation utilities
 * Implements SCRUM-75: Input validation for all query params
 */

/**
 * Sanitize string input - remove potential injection attempts
 */
export function sanitizeString(input: string, maxLength = 500): string {
  // Trim whitespace
  let sanitized = input.trim();
  
  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove null bytes and control characters (except newlines/tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  return sanitized;
}

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string): string {
  const sanitized = sanitizeString(query, 200);
  
  if (sanitized.length === 0) {
    throw new ValidationError("Query cannot be empty");
  }
  
  // Block obvious injection patterns
  const injectionPatterns = [
    /\$\{.*\}/,           // Template injection
    /<script/i,           // XSS
    /javascript:/i,       // XSS
    /\bOR\s+1\s*=\s*1/i,  // SQL injection
    /;\s*DROP\s+/i,       // SQL injection
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      throw new ValidationError("Invalid characters in query");
    }
  }
  
  return sanitized;
}

/**
 * Validate section parameter
 */
export function validateSection(section: string): string {
  const sanitized = sanitizeString(section, 50).toLowerCase();
  
  // Only allow alphanumeric, hyphens, and slashes
  if (!/^[a-z0-9\-\/]+$/.test(sanitized)) {
    throw new ValidationError("Invalid section format");
  }
  
  return sanitized;
}

/**
 * Validate topic parameter
 */
export function validateTopic(topic: string): string {
  const sanitized = sanitizeString(topic, 100);
  
  if (sanitized.length === 0) {
    throw new ValidationError("Topic cannot be empty");
  }
  
  return sanitized;
}

/**
 * Validate article ID or slug
 */
export function validateArticleId(idOrSlug: string): string {
  const sanitized = sanitizeString(idOrSlug, 200);
  
  if (sanitized.length === 0) {
    throw new ValidationError("Article ID cannot be empty");
  }
  
  // Arc IDs are typically uppercase alphanumeric
  // Slugs can contain lowercase, numbers, hyphens
  if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(sanitized)) {
    throw new ValidationError("Invalid article ID format");
  }
  
  return sanitized;
}

/**
 * Validate limit parameter
 */
export function validateLimit(limit: number, max = 50): number {
  if (!Number.isInteger(limit)) {
    throw new ValidationError("Limit must be an integer");
  }
  
  if (limit < 1) {
    return 1;
  }
  
  if (limit > max) {
    return max;
  }
  
  return limit;
}

/**
 * Validate cursor parameter
 */
export function validateCursor(cursor: string): string {
  const sanitized = sanitizeString(cursor, 100);
  
  // Cursor should be numeric (offset) or opaque token
  if (!/^[a-zA-Z0-9\-_=]+$/.test(sanitized)) {
    throw new ValidationError("Invalid cursor format");
  }
  
  return sanitized;
}

/**
 * Validate ISO 8601 date string
 */
export function validateDate(dateStr: string): string {
  const sanitized = sanitizeString(dateStr, 30);
  
  // Basic ISO 8601 validation
  const date = new Date(sanitized);
  if (isNaN(date.getTime())) {
    throw new ValidationError("Invalid date format. Use ISO 8601.");
  }
  
  return date.toISOString();
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  code = "validation_error";
  
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validation schemas for tool parameters
 */
export const ValidatedSearchParams = z.object({
  query: z.string().transform(validateSearchQuery),
  section: z.string().optional().transform(s => s ? validateSection(s) : undefined),
  topic: z.string().optional().transform(s => s ? validateTopic(s) : undefined),
  region: z.string().optional().transform(s => s ? validateSection(s) : undefined),
  from_date: z.string().optional().transform(s => s ? validateDate(s) : undefined),
  to_date: z.string().optional().transform(s => s ? validateDate(s) : undefined),
  limit: z.number().default(10).transform(n => validateLimit(n)),
  cursor: z.string().optional().transform(s => s ? validateCursor(s) : undefined)
});

export const ValidatedGetArticleParams = z.object({
  article_id_or_slug: z.string().transform(validateArticleId)
});

export const ValidatedLatestParams = z.object({
  section: z.string().optional().transform(s => s ? validateSection(s) : undefined),
  region: z.string().optional().transform(s => s ? validateSection(s) : undefined),
  limit: z.number().default(10).transform(n => validateLimit(n)),
  cursor: z.string().optional().transform(s => s ? validateCursor(s) : undefined)
});

export const ValidatedTopicParams = z.object({
  topic: z.string().transform(validateTopic),
  section: z.string().optional().transform(s => s ? validateSection(s) : undefined),
  limit: z.number().default(10).transform(n => validateLimit(n)),
  cursor: z.string().optional().transform(s => s ? validateCursor(s) : undefined)
});

export const ValidatedRelatedParams = z.object({
  article_id_or_slug: z.string().transform(validateArticleId),
  limit: z.number().default(5).transform(n => validateLimit(n, 20))
});
