# Inquirer Content MCP - Client Onboarding Guide

Welcome! This guide will help you integrate with the Philadelphia Inquirer's Content MCP server.

## Getting Started

### 1. Request Access

To use the Inquirer Content MCP, you'll need:

1. **API Key** - Contact [api@inquirer.com](mailto:api@inquirer.com) to request access
2. **Client Registration** - Provide your organization name and use case
3. **Rate Limit Agreement** - Default is 30 req/min; request higher if needed

### 2. Test Your Connection

Once you receive your API key, verify connectivity:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.inquirer.com/mcp/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "inquirer-content-mcp",
  "version": "0.1.0"
}
```

### 3. Try Your First Query

Search for recent Eagles coverage:

```bash
curl -X POST https://api.inquirer.com/mcp/search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "Eagles", "section": "sports", "limit": 3}'
```

---

## Common Use Cases

### Use Case 1: "What's happening in Philadelphia?"

Use `get_latest_news` to get the most recent articles:

```bash
GET /latest?limit=10
```

### Use Case 2: "Tell me about SEPTA"

Use `get_topic_news` for topic-specific coverage:

```bash
GET /topics/SEPTA?limit=5
```

### Use Case 3: "I have an article URL"

Extract the slug and use `get_article`:

```
URL: https://www.inquirer.com/sports/eagles/eagles-win-super-bowl-2026.html
Slug: eagles-win-super-bowl-2026

GET /articles/eagles-win-super-bowl-2026
```

### Use Case 4: "Find similar articles"

Use `get_related_articles` after retrieving an article:

```bash
GET /related/eagles-win-super-bowl-2026?limit=5
```

---

## Integration with AI Assistants

### Claude / ChatGPT

Example MCP tool definition:

```json
{
  "name": "search_inquirer",
  "description": "Search Philadelphia Inquirer articles",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "section": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["query"]
  }
}
```

### Response Formatting

When presenting articles to users, include:

1. **Headline** - Article title
2. **Summary** - Brief description
3. **Canonical URL** - Link for full article
4. **Published date** - For recency context

Example output:
```
📰 Eagles Win Super Bowl LX in Dominant Fashion
The Philadelphia Eagles captured their second Super Bowl title...
🔗 Read more: https://www.inquirer.com/eagles/...
📅 Published: Feb 8, 2026
```

---

## Content Guidelines

### What You Can Do

✅ Display headlines, summaries, and metadata  
✅ Link to full articles on inquirer.com  
✅ Use for search and discovery  
✅ Display staff photographs (when image_url is present)  

### What You Cannot Do

❌ Display full article text (not provided)  
❌ Cache content for extended periods  
❌ Redistribute to other systems  
❌ Scrape or bulk export  

### Attribution

Always attribute content to The Philadelphia Inquirer:

```
Source: The Philadelphia Inquirer
```

---

## Error Handling

### 404 Not Found

Article doesn't exist or is restricted (wire content).

```json
{
  "error": {
    "code": "not_found",
    "message": "Article not found: nonexistent-slug"
  }
}
```

**Action:** Check the article ID/slug is correct. Wire content (AP, Reuters) is intentionally restricted.

### 429 Rate Limited

Too many requests.

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Retry after 30 seconds."
  }
}
```

**Action:** Implement exponential backoff. Wait for `X-RateLimit-Reset` timestamp.

### 500 Internal Error

Server-side issue.

**Action:** Retry with exponential backoff. If persistent, contact support.

---

## Best Practices

1. **Cache Wisely** - Cache responses for 5-15 minutes to reduce API calls
2. **Use Pagination** - Don't request more than you need; use `limit` and `cursor`
3. **Handle Errors Gracefully** - Always check for error responses
4. **Respect Rate Limits** - Implement proper backoff
5. **Include Trace ID** - Log `X-Trace-ID` header for debugging

---

## Support

- **Email:** [api@inquirer.com](mailto:api@inquirer.com)
- **Documentation:** https://github.com/pobot-2026/inquirer-content-mcp
- **Status Page:** TBD

---

## FAQ

**Q: Why am I getting 404 for some articles?**  
A: Wire service content (AP, Reuters, Getty) is restricted for licensing reasons.

**Q: Why is `image_url` null?**  
A: Only staff photographer images are exposed. Wire service images are not available.

**Q: Can I get full article text?**  
A: No. Full text is not available via API. Use the `canonical_url` to direct users to the article.

**Q: How fresh is the content?**  
A: Content is near-real-time from the Arc XP CMS. New articles appear within minutes.

---

*Last updated: March 8, 2026*
