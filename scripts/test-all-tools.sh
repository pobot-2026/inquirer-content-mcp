#!/bin/bash
#
# Test all 5 MCP tools against the local dev server
# Usage: ./scripts/test-all-tools.sh [base_url]
#

BASE_URL="${1:-http://localhost:3000}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Inquirer Content MCP - Tool Test Suite             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Testing against: $BASE_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    
    echo -n "Testing $name... "
    
    if [ "$method" == "POST" ]; then
        response=$(curl -s -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s "$BASE_URL$endpoint")
    fi
    
    # Check if response contains expected field or error
    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
        # Show first few chars of response
        echo "   Response: $(echo "$response" | head -c 200)..."
    elif echo "$response" | grep -q '"error"'; then
        error_msg=$(echo "$response" | jq -r '.error.message // .error')
        echo -e "${RED}✗ FAIL${NC} - $error_msg"
        FAILED=$((FAILED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - Unexpected response"
        echo "   Response: $response"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Health check first
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Health" "GET" "/health" "" '"status":"ok"'

# Test 1: search_articles
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tool 1: search_articles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Search 'Eagles'" "POST" "/search" '{"query":"Eagles","limit":3}' '"articles"'
test_endpoint "Search with section filter" "POST" "/search" '{"query":"news","section":"sports","limit":2}' '"articles"'

# Test 2: get_article
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tool 2: get_article"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get article by ID" "GET" "/articles/abc123" "" '"headline"'
test_endpoint "Get nonexistent article" "GET" "/articles/nonexistent-id" "" '"error"'

# Test 3: get_latest_news
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tool 3: get_latest_news"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get latest news" "GET" "/latest?limit=5" "" '"articles"'
test_endpoint "Get latest by section" "GET" "/latest?section=sports&limit=3" "" '"articles"'

# Test 4: get_topic_news
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tool 4: get_topic_news"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get Eagles coverage" "GET" "/topics/Eagles?limit=3" "" '"articles"'
test_endpoint "Get SEPTA coverage" "GET" "/topics/SEPTA?limit=3" "" '"articles"'

# Test 5: get_related_articles
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tool 5: get_related_articles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get related articles" "GET" "/related/abc123?limit=3" "" '"articles"'

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
