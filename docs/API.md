# Inquirer Content MCP - API Documentation

## Overview

The Inquirer Content MCP provides structured access to Philadelphia Inquirer article metadata for AI clients via the Model Context Protocol.

**Base URL:** TBD (production)  
**Version:** 0.1.0  
**Authentication:** API key required (allowlisted clients only)

---

## Tools

### 1. search_articles

Search articles by keyword with optional filters.

**Endpoint:** `POST /search`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query |
| section | string | No | Filter by section (e.g., "sports", "news") |
| topic | string | No | Filter by topic (e.g., "Eagles", "SEPTA") |
| region | string | No | Filter by region |
| from_date | string | No | Start date (ISO 8601) |
| to_date | string | No | End date (ISO 8601) |
| limit | number | No | Results per page (1-50, default: 10) |
| cursor | string | No | Pagination cursor |

**Example:**
```json
{
  "query": "Eagles",
  "section": "sports",
  "limit": 5
}
```

**Response:**
```json
{
  "articles": [...],
  "next_cursor": "5"
}
```

---

### 2. get_article

Retrieve a single article by ID or slug.

**Endpoint:** `GET /articles/:id`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| article_id_or_slug | string | Yes | Article ID or canonical slug |

**Example:**
```
GET /articles/eagles-win-super-bowl-2026
```

**Response:**
```json
{
  "id": "FJS4NDJKURA3TJDHHMRRPWRUPY",
  "slug": "eagles-win-super-bowl-2026",
  "headline": "Eagles Win Super Bowl LX...",
  ...
}
```

**Errors:**
- `404 Not Found` - Article doesn't exist or is restricted

---

### 3. get_latest_news

Get the latest news articles.

**Endpoint:** `GET /latest`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| section | string | No | Filter by section |
| region | string | No | Filter by region |
| limit | number | No | Results per page (1-50, default: 10) |
| cursor | string | No | Pagination cursor |

**Example:**
```
GET /latest?section=sports&limit=5
```

---

### 4. get_topic_news

Get recent coverage for a specific topic.

**Endpoint:** `GET /topics/:topic`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| topic | string | Yes | Topic to search for |
| section | string | No | Filter by section |
| limit | number | No | Results per page (1-50, default: 10) |
| cursor | string | No | Pagination cursor |

**Example:**
```
GET /topics/Eagles?limit=5
```

---

### 5. get_related_articles

Get articles related to a given article.

**Endpoint:** `GET /related/:id`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| article_id_or_slug | string | Yes | Article ID or slug |
| limit | number | No | Number of related articles (1-20, default: 5) |

**Example:**
```
GET /related/eagles-win-super-bowl-2026?limit=3
```

---

## Article Schema

Every article response includes these 13 fields:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Stable internal identifier |
| slug | string | Canonical web slug |
| headline | string | Editorial headline |
| summary | string \| null | Brief description |
| author | string | Author display name |
| section | string | Editorial section |
| topics | string[] | Topic tags |
| published_at | string | Publish timestamp (ISO 8601) |
| updated_at | string | Last update timestamp (ISO 8601) |
| canonical_url | string | Article URL |
| access | enum | free \| registered \| subscriber \| restricted |
| source | string | Content source (staff, AP, etc.) |
| content_type | string | article \| liveblog \| guide \| analysis \| opinion \| review |
| image_url | string \| null | Image URL (staff photos only) |

---

## Content Policy

### Access Levels

| Level | Headline | Summary | Searchable |
|-------|----------|---------|------------|
| free | ✓ | ✓ | ✓ |
| registered | ✓ | ✓ | ✓ |
| subscriber | ✓ | ✓ | ✓ |
| restricted | — | — | — |

### Restricted Content

The following content types return 404:
- Wire service articles (AP, Reuters, Getty, AFP, UPI)
- Embargoed content
- Content marked as restricted in CMS

### Image Policy

- `image_url` is only populated for staff photographer images
- Wire service images return `null` to avoid licensing issues

---

## Errors

All errors follow this format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human readable message"
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| not_found | 404 | Article not found or restricted |
| validation_error | 400 | Invalid input parameters |
| rate_limited | 429 | Too many requests |
| internal_error | 500 | Server error |

---

## Rate Limits

- Default: 30 requests per minute
- Contact us for higher limits

Rate limit headers:
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Timestamp when limit resets

---

## Pagination

All list endpoints use cursor-based pagination.

**Request:**
```
GET /latest?limit=10&cursor=10
```

**Response:**
```json
{
  "articles": [...],
  "next_cursor": "20"
}
```

Pass `next_cursor` value to get the next page. `null` means no more results.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-03-08 | Initial release |
