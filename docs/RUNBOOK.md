# Inquirer Content MCP - Operational Runbook

## Overview

This runbook covers common operational scenarios for the Inquirer Content MCP server.

## Quick Reference

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Latency p95 | < 500ms | 500-1000ms | > 1000ms |
| Error rate | < 1% | 1-5% | > 5% |
| Arc API rate limit | < 80% | 80-95% | > 95% |

## Scenarios

### 1. Arc Content API Outage

**Symptoms:**
- All tools returning 500 errors
- Error logs showing "Arc API error"
- No new content being returned

**Investigation:**
```bash
# Check Arc API status
curl -s -H "Authorization: Bearer $PMN_SANDBOX_CONTENT_API" \
  "https://api.sandbox.pmn.arcpublishing.com/content/v4/search/published?website=philly-media-network&size=1&q=*"

# Check recent error logs
grep "Arc API error" /var/log/mcp-server.log | tail -20
```

**Resolution:**
1. Check Arc XP status page
2. Verify API credentials haven't expired
3. If Arc is down, MCP will return cached results (if caching enabled) or errors
4. Contact Arc XP support if outage persists > 15 minutes

**Escalation:** Platform Engineering → Arc XP Support

---

### 2. Rate Limit Exceeded

**Symptoms:**
- 429 errors from Arc API
- "Rate limit exceeded" in logs
- Degraded response times

**Investigation:**
```bash
# Check rate limit state
curl http://localhost:3000/health | jq '.rate_limit'

# Count recent requests
grep -c "tool" /var/log/mcp-server.log | tail -60
```

**Resolution:**
1. Rate limit resets after 60 seconds
2. If persistent, identify high-volume client from logs
3. Contact Arc to request rate limit increase

---

### 3. Stale Content

**Symptoms:**
- Articles missing recent updates
- Search not returning new articles
- `published_at` timestamps are old

**Investigation:**
```bash
# Check latest article timestamps
curl -s http://localhost:3000/latest?limit=5 | jq '.articles[].published_at'

# Verify Arc is returning fresh content
curl -s -H "Authorization: Bearer $PMN_SANDBOX_CONTENT_API" \
  "https://api.sandbox.pmn.arcpublishing.com/content/v4/search/published?website=philly-media-network&size=1&q=*&sort=display_date:desc" | jq '.content_elements[0].display_date'
```

**Resolution:**
1. If Arc returns fresh content but MCP doesn't, check caching layer
2. Clear cache if applicable
3. Verify indexing pipeline on Arc side

---

### 4. Wire Content Leaking

**Symptoms:**
- AP/Reuters/Getty content appearing in results
- `source` field showing "wires" or wire agency names

**Investigation:**
```bash
# Check for wire content in recent responses
curl -s http://localhost:3000/latest?limit=20 | jq '.articles[] | select(.source != "staff") | {headline, source}'
```

**Resolution:**
1. Check `WIRE_SOURCES` list in `arc-content-service.ts`
2. Add missing wire source identifiers
3. Verify `source.source_type` field mapping from Arc

**Severity:** HIGH - potential licensing violation

---

### 5. Schema Validation Failures

**Symptoms:**
- Clients reporting missing fields
- Type errors in responses

**Investigation:**
```bash
# Get sample article and verify all 13 fields
curl -s http://localhost:3000/articles/FJS4NDJKURA3TJDHHMRRPWRUPY | jq 'keys'

# Run schema validation tests
npm test -- tests/content-restriction.test.ts
```

**Resolution:**
1. Check Arc ANS schema for field changes
2. Update field mapping in `transformArticle()`
3. Add fallback values for optional Arc fields

---

### 6. High Latency

**Symptoms:**
- p95 latency > 1 second
- Clients timing out
- "duration_ms" values elevated in logs

**Investigation:**
```bash
# Check recent request durations
grep "duration_ms" /var/log/mcp-server.log | tail -20 | jq '.duration_ms'

# Check Arc API latency directly
time curl -s -H "Authorization: Bearer $PMN_SANDBOX_CONTENT_API" \
  "https://api.sandbox.pmn.arcpublishing.com/content/v4/search/published?website=philly-media-network&size=1&q=*" > /dev/null
```

**Resolution:**
1. If Arc is slow, escalate to Arc support
2. Consider enabling response caching
3. Review query complexity (reduce `limit`, simplify filters)

---

## Health Check

```bash
# Basic health
curl http://localhost:3000/health

# Full system check
./scripts/test-all-tools.sh http://localhost:3000
```

## Restart Procedures

### Local Dev
```bash
pkill -f "node dist/dev-server.js"
npm run start:server
```

### Production (Lambda)
```bash
# Force cold start by updating environment variable
aws lambda update-function-configuration \
  --function-name inquirer-content-mcp \
  --environment "Variables={RESTART_TIMESTAMP=$(date +%s)}"
```

## Contact

| Role | Contact |
|------|---------|
| On-call Engineer | #platform-oncall |
| Arc XP Support | support@arcpublishing.com |
| Product Owner | TBD |

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-03-08 | Po Bot | Initial runbook |
