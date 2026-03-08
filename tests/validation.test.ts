/**
 * Input Validation Tests
 * Implements SCRUM-75: Input validation for all query params
 */

import { describe, it, expect } from "vitest";
import {
  validateSearchQuery,
  validateSection,
  validateTopic,
  validateArticleId,
  validateLimit,
  validateCursor,
  validateDate,
  ValidationError,
  sanitizeString
} from "../src/utils/validation.js";

describe("Input Validation", () => {
  describe("sanitizeString", () => {
    it("should trim whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });
    
    it("should truncate to max length", () => {
      const longString = "a".repeat(1000);
      expect(sanitizeString(longString, 100).length).toBe(100);
    });
    
    it("should remove control characters", () => {
      expect(sanitizeString("hello\x00world")).toBe("helloworld");
    });
  });
  
  describe("validateSearchQuery", () => {
    it("should accept valid queries", () => {
      expect(validateSearchQuery("Eagles")).toBe("Eagles");
      expect(validateSearchQuery("Philadelphia news")).toBe("Philadelphia news");
    });
    
    it("should reject empty queries", () => {
      expect(() => validateSearchQuery("")).toThrow(ValidationError);
      expect(() => validateSearchQuery("   ")).toThrow(ValidationError);
    });
    
    it("should block template injection", () => {
      expect(() => validateSearchQuery("${process.env}")).toThrow(ValidationError);
    });
    
    it("should block XSS attempts", () => {
      expect(() => validateSearchQuery("<script>alert(1)</script>")).toThrow(ValidationError);
      expect(() => validateSearchQuery("javascript:alert(1)")).toThrow(ValidationError);
    });
    
    it("should block SQL injection patterns", () => {
      expect(() => validateSearchQuery("'; DROP TABLE articles;--")).toThrow(ValidationError);
      expect(() => validateSearchQuery("1 OR 1=1")).toThrow(ValidationError);
    });
  });
  
  describe("validateSection", () => {
    it("should accept valid sections", () => {
      expect(validateSection("sports")).toBe("sports");
      expect(validateSection("Sports")).toBe("sports");
      expect(validateSection("eagles/nfl")).toBe("eagles/nfl");
    });
    
    it("should reject invalid characters", () => {
      expect(() => validateSection("sports<script>")).toThrow(ValidationError);
      expect(() => validateSection("sports; DROP")).toThrow(ValidationError);
    });
  });
  
  describe("validateTopic", () => {
    it("should accept valid topics", () => {
      expect(validateTopic("Eagles")).toBe("Eagles");
      expect(validateTopic("SEPTA")).toBe("SEPTA");
      expect(validateTopic("Philadelphia 76ers")).toBe("Philadelphia 76ers");
    });
    
    it("should reject empty topics", () => {
      expect(() => validateTopic("")).toThrow(ValidationError);
    });
  });
  
  describe("validateArticleId", () => {
    it("should accept valid Arc IDs", () => {
      expect(validateArticleId("FJS4NDJKURA3TJDHHMRRPWRUPY")).toBe("FJS4NDJKURA3TJDHHMRRPWRUPY");
    });
    
    it("should accept valid slugs", () => {
      expect(validateArticleId("eagles-win-super-bowl-2026")).toBe("eagles-win-super-bowl-2026");
      expect(validateArticleId("/sports/eagles/story.html")).toBe("/sports/eagles/story.html");
    });
    
    it("should reject invalid characters", () => {
      expect(() => validateArticleId("id<script>")).toThrow(ValidationError);
      expect(() => validateArticleId("id;DROP")).toThrow(ValidationError);
    });
    
    it("should reject empty IDs", () => {
      expect(() => validateArticleId("")).toThrow(ValidationError);
    });
  });
  
  describe("validateLimit", () => {
    it("should accept valid limits", () => {
      expect(validateLimit(10)).toBe(10);
      expect(validateLimit(1)).toBe(1);
      expect(validateLimit(50)).toBe(50);
    });
    
    it("should cap at maximum", () => {
      expect(validateLimit(100)).toBe(50);
      expect(validateLimit(1000, 20)).toBe(20);
    });
    
    it("should floor at minimum", () => {
      expect(validateLimit(0)).toBe(1);
      expect(validateLimit(-5)).toBe(1);
    });
  });
  
  describe("validateCursor", () => {
    it("should accept valid cursors", () => {
      expect(validateCursor("10")).toBe("10");
      expect(validateCursor("abc123")).toBe("abc123");
      expect(validateCursor("eyJuZXh0IjoiMTAifQ==")).toBe("eyJuZXh0IjoiMTAifQ==");
    });
    
    it("should reject invalid cursors", () => {
      expect(() => validateCursor("<script>")).toThrow(ValidationError);
      expect(() => validateCursor("cursor;DROP")).toThrow(ValidationError);
    });
  });
  
  describe("validateDate", () => {
    it("should accept ISO 8601 dates", () => {
      expect(validateDate("2026-03-08")).toMatch(/2026-03-08/);
      expect(validateDate("2026-03-08T12:00:00Z")).toMatch(/2026-03-08/);
    });
    
    it("should reject invalid dates", () => {
      expect(() => validateDate("not-a-date")).toThrow(ValidationError);
      expect(() => validateDate("13/45/2026")).toThrow(ValidationError);
    });
  });
});

describe("Security Patterns", () => {
  it("should handle path traversal attempts", () => {
    expect(() => validateArticleId("../../../etc/passwd")).toThrow(ValidationError);
  });
  
  it("should handle null byte injection", () => {
    const result = sanitizeString("hello\x00world");
    expect(result).not.toContain("\x00");
  });
  
  it("should handle very long inputs", () => {
    const longInput = "a".repeat(10000);
    const result = sanitizeString(longInput, 500);
    expect(result.length).toBe(500);
  });
});
