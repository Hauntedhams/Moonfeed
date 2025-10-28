#!/bin/bash

# 🎯 Affiliate System Quick Test Guide
# Run these commands step-by-step to test the affiliate system

echo "🎯 Moonfeed Affiliate System - Quick Test Guide"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create an affiliate
echo -e "${BLUE}Step 1: Creating your first affiliate...${NC}"
echo ""
echo "Command:"
echo -e "${GREEN}curl -X POST http://localhost:3001/api/affiliates/create \\
  -H \"Content-Type: application/json\" \\
  -d '{
    \"code\": \"influencer1\",
    \"name\": \"Influencer Demo\",
    \"walletAddress\": \"DemoWallet123456789abcdefghijklmnopqrstuvwx\",
    \"sharePercentage\": 50,
    \"email\": \"demo@example.com\",
    \"telegram\": \"@demoinfluencer\"
  }'${NC}"
echo ""
read -p "Press Enter to create affiliate..."

curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "influencer1",
    "name": "Influencer Demo",
    "walletAddress": "DemoWallet123456789abcdefghijklmnopqrstuvwx",
    "sharePercentage": 50,
    "email": "demo@example.com",
    "telegram": "@demoinfluencer"
  }'

echo ""
echo ""

# Step 2: View all affiliates
echo -e "${BLUE}Step 2: Viewing all affiliates...${NC}"
echo ""
echo "Command:"
echo -e "${GREEN}curl http://localhost:3001/api/affiliates/list${NC}"
echo ""
read -p "Press Enter to view affiliates..."

curl http://localhost:3001/api/affiliates/list | json_pp

echo ""
echo ""

# Step 3: Generate referral link
echo -e "${BLUE}Step 3: Your Referral Link!${NC}"
echo ""
echo -e "${YELLOW}🔗 Referral Link:${NC}"
echo -e "${GREEN}http://localhost:5173?ref=influencer1${NC}"
echo ""
echo "📋 Share this link with your influencer!"
echo ""
read -p "Press Enter to continue..."

# Step 4: Validate the referral code
echo ""
echo -e "${BLUE}Step 4: Validating referral code...${NC}"
echo ""
echo "Command:"
echo -e "${GREEN}curl http://localhost:3001/api/affiliates/validate/influencer1${NC}"
echo ""
read -p "Press Enter to validate..."

curl http://localhost:3001/api/affiliates/validate/influencer1 | json_pp

echo ""
echo ""

# Step 5: Simulate a trade
echo -e "${BLUE}Step 5: Simulating a trade (user came from referral link)...${NC}"
echo ""
echo "Scenario: User swaps \$1000 worth of SOL → BONK (1% fee = \$10)"
echo ""
echo "Command:"
echo -e "${GREEN}curl -X POST http://localhost:3001/api/affiliates/track-trade \\
  -H \"Content-Type: application/json\" \\
  -d '{
    \"referralCode\": \"influencer1\",
    \"userWallet\": \"UserWallet123xyz\",
    \"tradeVolume\": 1000,
    \"feeEarned\": 10,
    \"tokenIn\": \"SOL\",
    \"tokenOut\": \"BONK\",
    \"transactionSignature\": \"DemoTx123456789\"
  }'${NC}"
echo ""
read -p "Press Enter to track trade..."

curl -X POST http://localhost:3001/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "influencer1",
    "userWallet": "UserWallet123xyz",
    "tradeVolume": 1000,
    "feeEarned": 10,
    "tokenIn": "SOL",
    "tokenOut": "BONK",
    "transactionSignature": "DemoTx123456789"
  }' | json_pp

echo ""
echo ""

# Step 6: Check affiliate stats
echo -e "${BLUE}Step 6: Checking affiliate earnings...${NC}"
echo ""
echo "Command:"
echo -e "${GREEN}curl http://localhost:3001/api/affiliates/influencer1/stats${NC}"
echo ""
read -p "Press Enter to view stats..."

curl http://localhost:3001/api/affiliates/influencer1/stats | json_pp

echo ""
echo ""

# Step 7: Check pending earnings
echo -e "${BLUE}Step 7: Checking pending earnings (ready for payout)...${NC}"
echo ""
echo "Command:"
echo -e "${GREEN}curl http://localhost:3001/api/affiliates/influencer1/pending-earnings${NC}"
echo ""
read -p "Press Enter to check pending earnings..."

curl http://localhost:3001/api/affiliates/influencer1/pending-earnings | json_pp

echo ""
echo ""

# Summary
echo -e "${YELLOW}✅ Test Complete!${NC}"
echo ""
echo "📊 Summary:"
echo "  - Affiliate created: influencer1"
echo "  - Referral link: http://localhost:5173?ref=influencer1"
echo "  - Trade tracked: \$1000 volume, \$10 fee"
echo "  - Jupiter cut (20%): \$2"
echo "  - Net fee: \$8"
echo "  - Influencer share (50%): \$4"
echo "  - Platform share (50%): \$4"
echo ""
echo "📝 Next Steps:"
echo "  1. Test the referral link in your browser"
echo "  2. Check localStorage for referral code"
echo "  3. Make a real trade to test tracking"
echo "  4. Process a payout when ready"
echo ""
echo "📖 For more info, see: AFFILIATE_SYSTEM_README.md"
echo ""
