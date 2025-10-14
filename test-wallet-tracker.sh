#!/bin/bash

# 🧪 Wallet Tracker Feature - Testing Script
# This script helps test the wallet tracker functionality

echo "🔍 ═══════════════════════════════════════════════════"
echo "🔍 WALLET TRACKER - TESTING GUIDE"
echo "🔍 ═══════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Check if .env file exists
echo -e "${BLUE}📋 Test 1: Checking environment setup...${NC}"
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Check if SOLANA_TRACKER_API_KEY is set
    if grep -q "SOLANA_TRACKER_API_KEY" backend/.env; then
        echo -e "${GREEN}✅ SOLANA_TRACKER_API_KEY is configured${NC}"
    else
        echo -e "${RED}❌ SOLANA_TRACKER_API_KEY not found in .env${NC}"
        echo -e "${YELLOW}⚠️  Add: SOLANA_TRACKER_API_KEY=your_key_here${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}⚠️  Create backend/.env and add SOLANA_TRACKER_API_KEY${NC}"
fi
echo ""

# Test 2: Check if backend files exist
echo -e "${BLUE}📋 Test 2: Checking backend files...${NC}"
if [ -f "backend/routes/walletRoutes.js" ]; then
    echo -e "${GREEN}✅ walletRoutes.js exists${NC}"
else
    echo -e "${RED}❌ walletRoutes.js not found${NC}"
fi

if grep -q "walletRoutes" backend/server.js; then
    echo -e "${GREEN}✅ walletRoutes mounted in server.js${NC}"
else
    echo -e "${RED}❌ walletRoutes not mounted in server.js${NC}"
fi
echo ""

# Test 3: Check if frontend files exist
echo -e "${BLUE}📋 Test 3: Checking frontend files...${NC}"
if [ -f "frontend/src/components/WalletModal.jsx" ]; then
    echo -e "${GREEN}✅ WalletModal.jsx exists${NC}"
else
    echo -e "${RED}❌ WalletModal.jsx not found${NC}"
fi

if [ -f "frontend/src/components/WalletModal.css" ]; then
    echo -e "${GREEN}✅ WalletModal.css exists${NC}"
else
    echo -e "${RED}❌ WalletModal.css not found${NC}"
fi

if grep -q "WalletModal" frontend/src/components/TopTradersList.jsx; then
    echo -e "${GREEN}✅ WalletModal imported in TopTradersList${NC}"
else
    echo -e "${RED}❌ WalletModal not imported in TopTradersList${NC}"
fi
echo ""

# Test 4: Check if servers are running
echo -e "${BLUE}📋 Test 4: Checking if servers are running...${NC}"

# Check backend
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✅ Backend running on port 3001${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not running${NC}"
    echo -e "${BLUE}   Start with: cd backend && npm run dev${NC}"
fi

# Check frontend
if lsof -Pi :5175 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✅ Frontend running on port 5175${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend not running${NC}"
    echo -e "${BLUE}   Start with: cd frontend && npm run dev${NC}"
fi
echo ""

# Test 5: Test API endpoint (if backend is running)
echo -e "${BLUE}📋 Test 5: Testing API endpoint...${NC}"
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    # Use a known Solana wallet for testing (system program ID)
    TEST_WALLET="11111111111111111111111111111111"
    
    echo -e "${BLUE}Testing: GET /api/wallet/${TEST_WALLET}${NC}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:3001/api/wallet/${TEST_WALLET}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ API endpoint responding (HTTP 200)${NC}"
        echo -e "${BLUE}Response preview:${NC}"
        echo "$BODY" | head -c 200
        echo "..."
    else
        echo -e "${RED}❌ API endpoint error (HTTP ${HTTP_CODE})${NC}"
        echo -e "${YELLOW}Response: ${BODY}${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping API test (backend not running)${NC}"
fi
echo ""

# Manual testing instructions
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📱 MANUAL TESTING INSTRUCTIONS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Step 1:${NC} Open http://localhost:5175 in your browser"
echo -e "${GREEN}Step 2:${NC} Navigate to any coin (scroll through feed)"
echo -e "${GREEN}Step 3:${NC} Expand the coin by swiping down"
echo -e "${GREEN}Step 4:${NC} Click the 'Load Top Traders' button"
echo -e "${GREEN}Step 5:${NC} Wait for traders list to load"
echo -e "${GREEN}Step 6:${NC} ${YELLOW}Click on any wallet address${NC} (purple text)"
echo -e "${GREEN}Step 7:${NC} Wallet modal should pop up"
echo -e "${GREEN}Step 8:${NC} Verify data loads correctly"
echo -e "${GREEN}Step 9:${NC} Test close functionality (× button or click outside)"
echo ""

# Expected behavior
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}✅ EXPECTED BEHAVIOR${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo "When you click a wallet address, you should see:"
echo -e "${GREEN}✓${NC} Modal appears with smooth animation"
echo -e "${GREEN}✓${NC} Loading spinner shows briefly"
echo -e "${GREEN}✓${NC} Wallet data loads within 1-2 seconds"
echo -e "${GREEN}✓${NC} All sections display properly:"
echo "  • Wallet Address (with Solscan link)"
echo "  • Balance (SOL + USD)"
echo "  • Trading Statistics"
echo "  • Transaction Activity"
echo "  • Performance Metrics"
echo -e "${GREEN}✓${NC} Values are color-coded (green/red)"
echo -e "${GREEN}✓${NC} Modal closes when clicking × or backdrop"
echo -e "${GREEN}✓${NC} No console errors in browser DevTools"
echo ""

# Common issues
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🐛 COMMON ISSUES & SOLUTIONS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${RED}Issue 1:${NC} Modal doesn't open"
echo -e "${YELLOW}Fix:${NC} Check browser console for React errors"
echo ""
echo -e "${RED}Issue 2:${NC} API error / No data"
echo -e "${YELLOW}Fix:${NC} Verify SOLANA_TRACKER_API_KEY in backend/.env"
echo ""
echo -e "${RED}Issue 3:${NC} Styling looks broken"
echo -e "${YELLOW}Fix:${NC} Ensure WalletModal.css is imported"
echo ""
echo -e "${RED}Issue 4:${NC} Backend not connecting"
echo -e "${YELLOW}Fix:${NC} Check backend is running on port 3001"
echo ""

# Quick commands
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}⚡ QUICK COMMANDS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Start Backend:${NC}"
echo "  cd backend && npm run dev"
echo ""
echo -e "${GREEN}Start Frontend:${NC}"
echo "  cd frontend && npm run dev"
echo ""
echo -e "${GREEN}Test API Manually:${NC}"
echo "  curl http://localhost:3001/api/wallet/11111111111111111111111111111111"
echo ""
echo -e "${GREEN}Check Backend Logs:${NC}"
echo "  tail -f backend/console.log  (if logging to file)"
echo ""
echo -e "${GREEN}Open Browser DevTools:${NC}"
echo "  F12 or Cmd+Option+I (Mac)"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Testing script complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
