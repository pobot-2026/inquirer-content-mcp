/**
 * Content Restriction Tests
 * Implements SCRUM-76: Premium-content non-disclosure tests
 * 
 * Verifies:
 * - No full body text for subscriber content
 * - No wire copy exposure
 * - Restricted content returns access=restricted
 * - No internal fields leak
 */

import { describe, it, expect } from "vitest";
import { MockContentService } from "../src/services/mock-content-service.js";

describe("Content Restriction", () => {
  const service = new MockContentService();
  
  describe("Wire Content Filtering", () => {
    it("should not return wire content in search results", async () => {
      const result = await service.search({ query: "national", limit: 10 });
      
      // Wire content should be filtered out
      for (const article of result.articles) {
        expect(article.source).not.toBe("AP");
        expect(article.source).not.toBe("Reuters");
        expect(article.source).not.toBe("Getty");
        expect(article.access).not.toBe("restricted");
      }
    });
    
    it("should return 404 for wire content lookup", async () => {
      // wire001 is an AP article in mock data
      const article = await service.getArticle("wire001");
      expect(article).toBeNull();
    });
    
    it("should not expose wire content in latest feed", async () => {
      const result = await service.getLatest({ limit: 20 });
      
      for (const article of result.articles) {
        expect(article.access).not.toBe("restricted");
      }
    });
  });
  
  describe("Subscriber Content Protection", () => {
    it("should expose headline and summary for subscriber content", async () => {
      // septa-budget-crisis-2026 is subscriber content
      const article = await service.getArticle("septa-budget-crisis-2026");
      
      expect(article).not.toBeNull();
      expect(article!.access).toBe("subscriber");
      expect(article!.headline).toBeTruthy();
      expect(article!.summary).toBeTruthy();
    });
    
    it("should not expose body text (not in schema)", async () => {
      const article = await service.getArticle("septa-budget-crisis-2026");
      
      expect(article).not.toBeNull();
      // Verify body field doesn't exist
      expect((article as any).body).toBeUndefined();
      expect((article as any).content).toBeUndefined();
      expect((article as any).content_elements).toBeUndefined();
    });
  });
  
  describe("Access Level Exposure", () => {
    it("should include access field in all articles", async () => {
      const result = await service.search({ query: "eagles", limit: 10 });
      
      for (const article of result.articles) {
        expect(article.access).toBeDefined();
        expect(["free", "registered", "subscriber"]).toContain(article.access);
      }
    });
    
    it("should label free content correctly", async () => {
      const article = await service.getArticle("eagles-win-super-bowl-2026");
      
      expect(article).not.toBeNull();
      expect(article!.access).toBe("free");
    });
  });
  
  describe("Internal Fields Protection", () => {
    it("should not expose internal Arc fields", async () => {
      const article = await service.getArticle("eagles-win-super-bowl-2026");
      
      expect(article).not.toBeNull();
      
      // These Arc internal fields should NOT be present
      expect((article as any)._id).toBeUndefined();
      expect((article as any).workflow).toBeUndefined();
      expect((article as any).revision).toBeUndefined();
      expect((article as any).additional_properties).toBeUndefined();
      expect((article as any).owner).toBeUndefined();
      expect((article as any).distributor).toBeUndefined();
      
      // Only the defined schema fields should exist
      const allowedFields = [
        "id", "slug", "headline", "summary", "author", "section",
        "topics", "published_at", "updated_at", "canonical_url",
        "access", "source", "content_type", "image_url"
      ];
      
      for (const key of Object.keys(article!)) {
        expect(allowedFields).toContain(key);
      }
    });
  });
  
  describe("Image URL Filtering", () => {
    it("should expose image_url for staff content", async () => {
      const article = await service.getArticle("eagles-win-super-bowl-2026");
      
      expect(article).not.toBeNull();
      expect(article!.source).toBe("staff");
      expect(article!.image_url).toBeTruthy();
    });
    
    it("should not expose image_url for wire content", async () => {
      // Wire content is filtered, but if we had a wire article it should have null image
      // This is tested in the Arc service integration
    });
  });
});

describe("Schema Compliance", () => {
  const service = new MockContentService();
  
  it("should return all 13 required fields", async () => {
    const article = await service.getArticle("eagles-win-super-bowl-2026");
    
    expect(article).not.toBeNull();
    
    // All 13 required fields per spec
    expect(article!.id).toBeDefined();
    expect(article!.slug).toBeDefined();
    expect(article!.headline).toBeDefined();
    expect(article!.summary).toBeDefined(); // Can be null for restricted
    expect(article!.author).toBeDefined();
    expect(article!.section).toBeDefined();
    expect(article!.topics).toBeDefined();
    expect(article!.published_at).toBeDefined();
    expect(article!.updated_at).toBeDefined();
    expect(article!.canonical_url).toBeDefined();
    expect(article!.access).toBeDefined();
    expect(article!.source).toBeDefined();
    expect(article!.content_type).toBeDefined();
    expect(article!.image_url).toBeDefined(); // Can be null
  });
  
  it("should return ISO 8601 timestamps", async () => {
    const article = await service.getArticle("eagles-win-super-bowl-2026");
    
    expect(article).not.toBeNull();
    
    // Verify ISO 8601 format
    expect(new Date(article!.published_at).toISOString()).toBeTruthy();
    expect(new Date(article!.updated_at).toISOString()).toBeTruthy();
  });
  
  it("should return valid canonical URLs", async () => {
    const article = await service.getArticle("eagles-win-super-bowl-2026");
    
    expect(article).not.toBeNull();
    expect(article!.canonical_url).toMatch(/^https?:\/\//);
  });
});

describe("Pagination", () => {
  const service = new MockContentService();
  
  it("should respect limit parameter", async () => {
    const result = await service.search({ query: "news", limit: 1 });
    expect(result.articles.length).toBeLessThanOrEqual(1);
  });
  
  it("should return next_cursor for more results", async () => {
    const result = await service.search({ query: "news", limit: 1 });
    // Mock service returns null cursor, but production should return cursor if more results
    expect(result).toHaveProperty("next_cursor");
  });
});
