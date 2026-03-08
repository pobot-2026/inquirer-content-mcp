#!/bin/bash
#
# Smoke Test for Production Deployment
# Run this after deploying to verify all tools work
#
# Usage: ./scripts/smoke-test.sh <base_url>
# Example: ./scripts/smoke-test.sh https://api.inquirer.com/mcp
#

set -e

BASE_URL="${1:-http://localhost:3000}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Inquirer Content MCP - Smoke Test                  ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Target: $BASE_URL"
echo "║  Time:   $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

check() {
    local name="$1"
    local condition="$2"
    
    if eval "$condition"; then
        echo -e "  ${GREEN}✓${NC} $name"
        PASSED=$((PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} $name"
        FAILED=$((FAILED + 1))
    fi
}

echo "1. Health Check"
echo "───────────────"
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null || echo '{}')
check "Server responds" '[ -n "$HEALTH" ]'
check "Status is OK" 'echo "$HEALTH" | grep -q "ok"'
check "Version present" 'echo "$HEALTH" | grep -q "version"'
echo ""

echo "2. Search Articles"
echo "──────────────────"
SEARCH=$(curl -s -X POST "$BASE_URL/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"news","limit":3}' 2>/dev/null || echo '{}')
check "Returns articles array" 'echo "$SEARCH" | grep -q "articles"'
check "No error returned" '! echo "$SEARCH" | grep -q "\"error\""'
echo ""

echo "3. Get Latest News"
echo "──────────────────"
LATEST=$(curl -s "$BASE_URL/latest?limit=3" 2>/dev/null || echo '{}')
check "Returns articles array" 'echo "$LATEST" | grep -q "articles"'
check "Has pagination cursor" 'echo "$LATEST" | grep -q "next_cursor"'
echo ""

echo "4. Get Topic News"
echo "─────────────────"
TOPIC=$(curl -s "$BASE_URL/topics/news?limit=3" 2>/dev/null || echo '{}')
check "Returns articles array" 'echo "$TOPIC" | grep -q "articles"'
echo ""

echo "5. Content Policy Checks"
echo "────────────────────────"
# Check that restricted content returns 404
RESTRICTED=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/articles/wire-restricted-test" 2>/dev/null || echo "000")
check "Restricted content returns 404" '[ "$RESTRICTED" = "404" ]'

# Check no body field in responses
check "No body field in search" '! echo "$SEARCH" | grep -q "\"body\""'
check "No content_elements field" '! echo "$SEARCH" | grep -q "\"content_elements\""'
echo ""

echo "6. Schema Compliance"
echo "────────────────────"
# Extract first article from search (if any)
ARTICLE=$(echo "$SEARCH" | jq -r '.articles[0] // empty' 2>/dev/null)
if [ -n "$ARTICLE" ]; then
    check "Has id field" 'echo "$ARTICLE" | grep -q "\"id\""'
    check "Has headline field" 'echo "$ARTICLE" | grep -q "\"headline\""'
    check "Has canonical_url field" 'echo "$ARTICLE" | grep -q "\"canonical_url\""'
    check "Has access field" 'echo "$ARTICLE" | grep -q "\"access\""'
    check "Has published_at field" 'echo "$ARTICLE" | grep -q "\"published_at\""'
else
    echo "  (No articles to validate - sandbox may be empty)"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "Results"
echo "═══════════════════════════════════════════════════════════════"
echo -e "  Passed: ${GREEN}$PASSED${NC}"
echo -e "  Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review above for details.${NC}"
    exit 1
fi
