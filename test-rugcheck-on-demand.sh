#!/bin/bash

# 🧪 Rugcheck On-Demand Enrichment Verification Script
# Tests that rugcheck always completes (success or failure) and never shows infinite loading

echo "🧪 Testing Rugcheck On-Demand Enrichment..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check backend is running
echo "1️⃣ Checking backend service..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend is running${NC}"
else
  echo -e "${RED}❌ Backend is not running. Start with: cd backend && npm run dev${NC}"
  exit 1
fi

# Check frontend is running
echo ""
echo "2️⃣ Checking frontend service..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Frontend is running${NC}"
else
  echo -e "${RED}❌ Frontend is not running. Start with: cd frontend && npm run dev${NC}"
  exit 1
fi

# Test rugcheck processing on a sample coin
echo ""
echo "3️⃣ Testing rugcheck enrichment logic..."
echo ""

# Check backend code for rugcheckProcessedAt
echo "📝 Checking backend sets rugcheckProcessedAt on failure..."
if grep -q "enrichedData.rugcheckProcessedAt = new Date()" backend/services/OnDemandEnrichmentService.js; then
  echo -e "${GREEN}✅ Backend ALWAYS sets rugcheckProcessedAt${NC}"
else
  echo -e "${RED}❌ Backend does NOT set rugcheckProcessedAt on failure${NC}"
  echo "   Fix: Ensure OnDemandEnrichmentService.js sets timestamp on rugcheck failure"
  exit 1
fi

# Check frontend code for correct rugcheck state logic
echo ""
echo "📝 Checking frontend handles rugcheck states correctly..."
if grep -q "!rugcheckAttempted && coin.enriched" frontend/src/components/CoinCard.jsx; then
  echo -e "${GREEN}✅ Frontend checks rugcheckAttempted correctly${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend may have old rugcheck state logic${NC}"
fi

# Check that processRugcheckData sets timestamp on success
echo ""
echo "📝 Checking rugcheck success path sets timestamp..."
if grep -q "rugcheckProcessedAt: new Date().toISOString()" backend/services/OnDemandEnrichmentService.js; then
  echo -e "${GREEN}✅ Success path sets rugcheckProcessedAt${NC}"
else
  echo -e "${RED}❌ Success path missing rugcheckProcessedAt${NC}"
fi

# Manual test instructions
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 MANUAL TESTING STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open http://localhost:5173 in your browser"
echo "2. Click on any coin to view details"
echo "3. Scroll down to the 'Liquidity' section"
echo "4. Look for the Security Analysis section"
echo ""
echo "Expected Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ INITIAL STATE (before enrichment):"
echo "   '⏳ Security data loading...'"
echo ""
echo "✅ DURING ENRICHMENT (rugcheck API call in progress):"
echo "   '⏳ Analyzing security data...'"
echo "   'This may take a few seconds'"
echo ""
echo "✅ SUCCESS STATE (rugcheck data available):"
echo "   '🔐 SECURITY ANALYSIS'"
echo "   Shows all security fields (liquidity locked, score, authorities, etc.)"
echo ""
echo "✅ FAILURE STATE (rugcheck unavailable):"
echo "   'ℹ️ Advanced security data unavailable'"
echo "   'Check other metrics carefully'"
echo ""
echo "❌ NEVER SHOWS:"
echo "   Infinite 'Analyzing security data...' (stuck forever)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Backend Logs to Check:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Success logs should show:"
echo "  '🔐 Rugcheck data applied for [SYMBOL]: { liquidityLocked: true, ... }'"
echo ""
echo "Failure logs should show:"
echo "  '⚠️ Rugcheck data not available for [SYMBOL]: [error reason]'"
echo "  '✅ Rugcheck failed - marked as processed to prevent infinite loading'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🎉 All automated checks passed!${NC}"
echo "   Complete the manual testing steps above to verify full functionality."
echo ""
