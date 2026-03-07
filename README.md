# Inquirer Content MCP

External Content MCP server for The Philadelphia Inquirer. Provides structured access to article metadata for AI clients via the Model Context Protocol.

## Overview

This MCP server exposes 5 tools for discovering and retrieving article content:

| Tool | Description |
|------|-------------|
| `search_articles` | Keyword search with filters (section, topic, region, date) |
| `get_article` | Retrieve single article by ID or slug |
| `get_latest_news` | Latest articles by section/region |
| `get_topic_news` | Topic-based coverage feed |
| `get_related_articles` | Related articles for a given article |

## Content Policy

- **Summaries**: AI-generated with editorial approval
- **Images**: Staff photos only (wire service images omitted)
- **Access levels**: `free`, `registered`, `subscriber`, `restricted`
- **Restricted content**: Returns 404 (wire copy, embargoed content hidden)

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (stdio transport)
npm start
```

## Development

```bash
# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Architecture

```
src/
├── index.ts              # MCP server entry point
├── schemas/
│   └── article.ts        # Article schema (Zod)
├── services/
│   ├── content-service.ts      # Interface
│   └── mock-content-service.ts # Mock for dev
├── tools/
│   └── definitions.ts    # MCP tool definitions
└── utils/                # Utilities
```

## Article Schema

Every article response includes:

```typescript
{
  id: string;              // Stable internal ID
  slug: string;            // Canonical slug
  headline: string;        // Editorial headline
  summary: string | null;  // AI summary (null for restricted)
  author: string;          // Author display name
  section: string;         // Editorial section
  topics: string[];        // Topic tags
  published_at: string;    // ISO 8601
  updated_at: string;      // ISO 8601
  canonical_url: string;   // Article URL
  access: AccessLevel;     // free|registered|subscriber|restricted
  source: string;          // staff|AP|etc
  content_type: string;    // article|liveblog|guide|etc
  image_url: string | null; // Staff photos only
}
```

## License

MIT
