/**
 * Rate limiting utilities
 * Implements SCRUM-72: Rate limiting (client-side tracking)
 * 
 * Note: Server-side rate limiting should be done at API Gateway level.
 * This module tracks Arc API rate limits to avoid hitting them.
 */

interface RateLimitState {
  requests: number[];  // Timestamps of recent requests
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

/**
 * Rate limiter for Arc API calls
 * Arc default: 30 requests per minute
 */
export class RateLimiter {
  private state: RateLimitState;
  
  constructor(maxRequests = 30, windowMs = 60000) {
    this.state = {
      requests: [],
      windowMs,
      maxRequests
    };
  }
  
  /**
   * Check if we can make a request
   */
  canRequest(): boolean {
    this.cleanup();
    return this.state.requests.length < this.state.maxRequests;
  }
  
  /**
   * Record a request
   */
  recordRequest(): void {
    this.state.requests.push(Date.now());
  }
  
  /**
   * Get remaining requests in current window
   */
  remaining(): number {
    this.cleanup();
    return Math.max(0, this.state.maxRequests - this.state.requests.length);
  }
  
  /**
   * Get time until rate limit resets (ms)
   */
  resetIn(): number {
    if (this.state.requests.length === 0) {
      return 0;
    }
    
    const oldestRequest = Math.min(...this.state.requests);
    const resetTime = oldestRequest + this.state.windowMs;
    return Math.max(0, resetTime - Date.now());
  }
  
  /**
   * Clean up old requests outside the window
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.state.windowMs;
    this.state.requests = this.state.requests.filter(ts => ts > cutoff);
  }
  
  /**
   * Wait until we can make a request
   */
  async waitForSlot(): Promise<void> {
    if (this.canRequest()) {
      return;
    }
    
    const waitTime = this.resetIn();
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
    }
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  code = "rate_limited";
  retryAfterMs: number;
  
  constructor(retryAfterMs: number) {
    super(`Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// Global rate limiter for Arc API
export const arcRateLimiter = new RateLimiter(25, 60000); // 25/min with 5 buffer
