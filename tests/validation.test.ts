/**
 * Input Validation Tests
 * Implements SCRUM-77: Parameter injection testing
 */

import { describe, it, expect } from "vitest";
import {
  validateSearchQuery,
  validateSection,
  validateArticleId,
  validateLimit,
  validateCursor,
  validateDate,
  ValidationError
} from "../src/utils/validation.js";

describe("Input Validation", () => {
  describe("validateSearchQuery", () => {
    it("should accept valid queries", () => {
      expect(validateSearchQuery("eagles")).toBe("eagles");
      expect(validateSearchQuery("super bowl")).toBe("super bowl");
      expect(validateSearchQuery("SEPTA budget")).toBe("SEPTA budget");
    });
    
    it("should trim whitespace", () => {
      expect(validateSearchQuery("  eagles  ")).toBe("eagles");
    });
    
    it("should truncate long queries", () => {
      const longQuery = "a".repeat(300);
      expect(validateSearchQuery(longQuery).length).toBe(200);
    });
    
    it("should reject empty queries", () => {
      expect(() => validateSearchQuery("")).toThrow(ValidationError);
      expect(() => validateSearchQuery("   ")).toThrow(ValidationError);
    });
    
    it("should reject template injection", () => {
      expect(() => validateSearchQuery("${process.env.SECRET}")).toThrow(ValidationError);
    });
    
    it("should reject XSS attempts", () => {
      expect(() => validateSearchQuery("<script>alert(1)</script>")).toThrow(ValidationError);
      expect(() => validateSearchQuery("javascript:alert(1)")).toThrow(ValidationError);
    });
    
    it("should reject SQL injection", () => {
      expect(() => validateSearchQuery("' OR 1=1 --")).toThrow(ValidationError);
      expect(() => validateSearchQuery("; DROP TABLE users;")).toThrow(ValidationError);
    });
  });
  
  describe("validateSection", () => {
    it("should accept valid sections", () => {
      expect(validateSection("news")).toBe("news");
      expect(validateSection("Sports")).toBe("sports");
      expect(validateSection("news/philadelphia")).toBe("news/philadelphia");
    });
    
    it("should reject invalid characters", () => {
      expect(() => validateSection("news<script>")).toThrow(ValidationError);
      expect(() => validateSection("news;DROP")).toThrow(ValidationError);
    });
  });
  
  describe("validateArticleId", () => {
    it("should accept valid Arc IDs", () => {
      expect(validateArticleId("BNWIUREVMJAYRI6RRWCH4KH6CQ")).toBe("BNWIUREVMJAYRI6RRWCH4KH6CQ");
    });
    
    it("should accept valid slugs", () => {
      expect(validateArticleId("eagles-win-super-bowl-2026")).toBe("eagles-win-super-bowl-2026");
    });
    
    it("should accept paths", () => {
      expect(validateArticleId("/eagles/story-slug")).toBe("/eagles/story-slug");
    });
    
    it("should reject empty IDs", () => {
      expect(() => validateArticleId("")).toThrow(ValidationError);
    });
    
    it("should reject special characters", () => {
      expect(() => validateArticleId("id<script>")).toThrow(ValidationError);
      expect(() => validateArticleId("id;DROP")).toThrow(ValidationError);
    });
  });
  
  describe("validateLimit", () => {
    it("should accept valid limits", () => {
      expect(validateLimit(10)).toBe(10);
      expect(validateLimit(50)).toBe(50);
    });
    
    it("should cap at maximum", () => {
      expect(validateLimit(100)).toBe(50);
      expect(validateLimit(1000)).toBe(50);
    });
    
    it("should floor at minimum", () => {
      expect(validateLimit(0)).toBe(1);
      expect(validateLimit(-5)).toBe(1);
    });
    
    it("should accept custom max", () => {
      expect(validateLimit(25, 20)).toBe(20);
    });
  });
  
  describe("validateCursor", () => {
    it("should accept numeric cursors", () => {
      expect(validateCursor("10")).toBe("10");
      expect(validateCursor("100")).toBe("100");
    });
    
    it("should accept opaque tokens", () => {
      expect(validateCursor("abc123")).toBe("abc123");
      expect(validateCursor("eyJwYWdlIjoxMH0=")).toBe("eyJwYWdlIjoxMH0=");
    });
    
    it("should reject invalid characters", () => {
      expect(() => validateCursor("cursor<>")).toThrow(ValidationError);
      expect(() => validateCursor("cursor;DROP")).toThrow(ValidationError);
    });
  });
  
  describe("validateDate", () => {
    it("should accept ISO 8601 dates", () => {
      const result = validateDate("2026-03-07T00:00:00Z");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
    
    it("should accept date-only strings", () => {
      const result = validateDate("2026-03-07");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
    
    it("should reject invalid dates", () => {
      expect(() => validateDate("not-a-date")).toThrow(ValidationError);
      expect(() => validateDate("2026-13-45")).toThrow(ValidationError);
    });
  });
});

describe("Injection Prevention", () => {
  it("should handle null bytes", () => {
    const result = validateSearchQuery("test\x00injection");
    expect(result).not.toContain("\x00");
  });
  
  it("should handle unicode edge cases", () => {
    // Should not crash on unusual unicode
    expect(validateSearchQuery("test🦅eagles")).toBe("test🦅eagles");
  });
  
  it("should handle extremely long input", () => {
    const longInput = "a".repeat(10000);
    const result = validateSearchQuery(longInput);
    expect(result.length).toBe(200);
  });
});
