#!/bin/bash

# Test Script: Fee Split Demonstration
# Shows exactly where affiliate and platform splits appear

echo "🧪 Fee Split Demonstration Test"
echo "================================"
echo ""

BASE_URL="http://localhost:5000"

echo "1️⃣  Creating test affiliate 'demokid' with 60% share..."
curl -s -X POST $BASE_URL/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "demokid",
    "name": "Demo Kid",
    "walletAddress": "DemoWallet123ABC",
    "sharePercentage": 60
  }' | jq '.'

echo ""
echo "2️⃣  Recording a trade: $5,000 volume, $10.00 fee..."
echo "    Expected splits:"
echo "    - Jupiter cut: $2.00 (20%)"
echo "    - Net fee: $8.00 (80%)"
echo "    - Affiliate share: $4.80 (60% of net)"
echo "    - Platform share: $3.20 (40% of net)"
echo ""

TRADE_RESULT=$(curl -s -X POST $BASE_URL/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "demokid",
    "userWallet": "TestUser456",
    "tradeVolume": 5000,
    "feeEarned": 10.0,
    "tokenIn": "SOL",
    "tokenOut": "BONK"
  }')

echo "$TRADE_RESULT" | jq '.'

echo ""
echo "3️⃣  Checking affiliate stats..."
curl -s $BASE_URL/api/affiliates/demokid/stats | jq '.stats'

echo ""
echo "4️⃣  Viewing the trade with splits..."
curl -s $BASE_URL/api/affiliates/demokid/trades | jq '.trades[0] | {
  tradeVolume,
  feeEarned,
  jupiterCut,
  netFee,
  influencerShare,
  platformShare,
  payoutStatus
}'

echo ""
echo "5️⃣  Checking platform (Ultra wallet) earnings..."
curl -s $BASE_URL/api/affiliates/platform/earnings | jq '.platformEarnings'

echo ""
echo "✅ Test complete!"
echo ""
echo "📊 Summary:"
echo "   - Fee splits are visible in EVERY trade record"
echo "   - View in API: GET /api/affiliates/:code/trades"
echo "   - View in dashboard: 'All Trades' tab"
echo "   - Platform earnings: GET /api/affiliates/platform/earnings"
echo ""
echo "🎯 To see in the dashboard:"
echo "   1. Open http://localhost:5173"
echo "   2. Navigate to Affiliate Dashboard"
echo "   3. Click 'All Trades' tab"
echo "   4. See the 'Platform Share' column!"
