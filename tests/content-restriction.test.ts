/**
 * Content Restriction Tests
 * Implements SCRUM-76: Automated tests for premium-content non-disclosure
 * 
 * These tests verify that:
 * 1. Wire content (AP, Reuters, Getty) is marked as restricted
 * 2. Restricted content returns 404 on direct lookup
 * 3. Restricted content is hidden from search results
 * 4. Staff photos are exposed, wire photos are not
 * 5. No full article body text is ever returned
 */

import { describe, it, expect, beforeAll } from "vitest";
import { MockContentService } from "../src/services/mock-content-service.js";
import type { Article } from "../src/schemas/article.js";

describe("Content Restriction Tests", () => {
  let contentService: MockContentService;
  
  beforeAll(() => {
    contentService = new MockContentService();
  });
  
  describe("Wire Content Filtering", () => {
    it("should not return wire content in search results", async () => {
      const result = await contentService.search({ query: "national", limit: 10 });
      
      // Wire content should be filtered out
      const wireArticles = result.articles.filter(a => 
        a.source === "AP" || a.source === "Reuters" || a.source === "wires"
      );
      
      expect(wireArticles.length).toBe(0);
    });
    
    it("should not return restricted articles in latest", async () => {
      const result = await contentService.getLatest({ limit: 50 });
      
      const restrictedArticles = result.articles.filter(a => a.access === "restricted");
      expect(restrictedArticles.length).toBe(0);
    });
    
    it("should return 404 for wire content direct lookup", async () => {
      // wire001 is a wire story in mock data
      const article = await contentService.getArticle("wire001");
      
      expect(article).toBeNull();
    });
  });
  
  describe("Access Level Enforcement", () => {
    it("should expose headline and summary for subscriber content", async () => {
      // def456 is a subscriber article in mock data
      const article = await contentService.getArticle("def456");
      
      expect(article).not.toBeNull();
      expect(article!.access).toBe("subscriber");
      expect(article!.headline).toBeDefined();
      expect(article!.summary).toBeDefined();
    });
    
    it("should expose all metadata for free content", async () => {
      const article = await contentService.getArticle("abc123");
      
      expect(article).not.toBeNull();
      expect(article!.access).toBe("free");
      expect(article!.headline).toBeDefined();
      expect(article!.summary).toBeDefined();
      expect(article!.canonical_url).toBeDefined();
    });
  });
  
  describe("Image URL Restrictions", () => {
    it("should expose image_url for staff photos", async () => {
      const article = await contentService.getArticle("abc123");
      
      expect(article).not.toBeNull();
      expect(article!.source).toBe("staff");
      expect(article!.image_url).toBeDefined();
      expect(article!.image_url).not.toBeNull();
    });
    
    it("should not expose image_url for wire content", async () => {
      // Wire content shouldn't be returned at all
      const article = await contentService.getArticle("wire001");
      expect(article).toBeNull();
    });
  });
  
  describe("Schema Compliance", () => {
    it("should return all 13 required fields", async () => {
      const article = await contentService.getArticle("abc123");
      
      expect(article).not.toBeNull();
      
      // Check all 13 required fields
      expect(article!.id).toBeDefined();
      expect(article!.slug).toBeDefined();
      expect(article!.headline).toBeDefined();
      expect(article!.summary).toBeDefined(); // Can be null, but must be present
      expect(article!.author).toBeDefined();
      expect(article!.section).toBeDefined();
      expect(article!.topics).toBeDefined();
      expect(Array.isArray(article!.topics)).toBe(true);
      expect(article!.published_at).toBeDefined();
      expect(article!.updated_at).toBeDefined();
      expect(article!.canonical_url).toBeDefined();
      expect(article!.access).toBeDefined();
      expect(article!.source).toBeDefined();
      expect(article!.content_type).toBeDefined();
    });
    
    it("should return ISO 8601 timestamps", async () => {
      const article = await contentService.getArticle("abc123");
      
      expect(article).not.toBeNull();
      
      // Verify timestamps are valid ISO 8601 (parseable by Date)
      const publishDate = new Date(article!.published_at);
      const updateDate = new Date(article!.updated_at);
      
      expect(publishDate.getTime()).not.toBeNaN();
      expect(updateDate.getTime()).not.toBeNaN();
      
      // Check format matches ISO 8601 pattern
      expect(article!.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
    
    it("should return canonical URLs (not temporary)", async () => {
      const article = await contentService.getArticle("abc123");
      
      expect(article).not.toBeNull();
      expect(article!.canonical_url).toMatch(/^https:\/\/www\.inquirer\.com\//);
      expect(article!.canonical_url).not.toContain("redirect");
      expect(article!.canonical_url).not.toContain("temp");
    });
  });
  
  describe("No Body Text Leak", () => {
    it("should never include full article body in response", async () => {
      const article = await contentService.getArticle("abc123");
      
      expect(article).not.toBeNull();
      
      // Ensure no body/content field exists
      expect((article as Record<string, unknown>).body).toBeUndefined();
      expect((article as Record<string, unknown>).content).toBeUndefined();
      expect((article as Record<string, unknown>).content_elements).toBeUndefined();
      expect((article as Record<string, unknown>).text).toBeUndefined();
    });
    
    it("should keep summary under reasonable length", async () => {
      const result = await contentService.search({ query: "Eagles", limit: 10 });
      
      for (const article of result.articles) {
        if (article.summary) {
          // Summary should be a brief description, not full text
          expect(article.summary.length).toBeLessThan(1000);
        }
      }
    });
  });
  
  describe("Pagination", () => {
    it("should return next_cursor for paginated results", async () => {
      const result = await contentService.search({ query: "news", limit: 2 });
      
      expect(result).toHaveProperty("next_cursor");
      expect(result).toHaveProperty("articles");
      expect(Array.isArray(result.articles)).toBe(true);
    });
    
    it("should respect limit parameter", async () => {
      const result = await contentService.search({ query: "news", limit: 1 });
      
      expect(result.articles.length).toBeLessThanOrEqual(1);
    });
  });
  
  describe("Error Handling", () => {
    it("should return null for non-existent articles", async () => {
      const article = await contentService.getArticle("non-existent-id-12345");
      
      expect(article).toBeNull();
    });
    
    it("should return empty array for no results", async () => {
      const result = await contentService.search({ 
        query: "xyznonexistentquery123", 
        limit: 10 
      });
      
      expect(result.articles).toEqual([]);
    });
  });
});
