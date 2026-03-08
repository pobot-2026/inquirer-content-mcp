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

# Copy environment config
cp .env.example .env
# Edit .env with your Arc XP credentials

# Build
npm run build

# Run (stdio transport)
npm start
```

## Configuration

Set these environment variables (or in `.env`):

| Variable | Description | Required |
|----------|-------------|----------|
| `PMN_SANDBOX_CONTENT_API` | Arc XP API token | Yes (for Arc) |
| `ARC_API_BASE_URL` | Arc API endpoint | No (defaults to sandbox) |
| `ARC_WEBSITE` | Arc website ID | No (defaults to philly-media-network) |

If no Arc credentials are provided, the server falls back to mock data.

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
├── index.ts                    # MCP server entry point
├── schemas/
│   └── article.ts              # Article schema (Zod)
├── services/
│   ├── content-service.ts      # Interface
│   ├── arc-content-service.ts  # Arc XP implementation
│   └── mock-content-service.ts # Mock for dev
├── tools/
│   └── definitions.ts          # MCP tool definitions
└── utils/                      # Utilities
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

## Arc XP Integration

The service connects to Arc XP Content API v4:

- **Search**: `/content/v4/search/published`
- **Article**: `/content/v4/stories`
- **Websites**: `/site/v3/website`

### Field Mapping

| MCP Field | Arc ANS Field |
|-----------|---------------|
| `id` | `_id` |
| `slug` | `slug` |
| `headline` | `headlines.basic` |
| `summary` | `description.basic` |
| `author` | `credits.by[0].name` |
| `section` | `taxonomy.primary_section.name` |
| `topics` | `taxonomy.tags[].text` |
| `published_at` | `publish_date` |
| `updated_at` | `last_updated_date` |
| `canonical_url` | `websites[website].website_url` |
| `access` | derived from `source.source_type`, `content_restrictions` |
| `source` | `source.source_type` |
| `content_type` | `type` |
| `image_url` | `promo_items.basic.url` (staff only) |

### Wire Content Filtering

The following sources are automatically marked as `restricted`:
- Associated Press (AP)
- Reuters
- Getty
- AFP
- UPI

## Rate Limits

Arc Content API has a default rate limit of 30 requests/minute. Contact Arc XP support for increases.

## License

MIT
