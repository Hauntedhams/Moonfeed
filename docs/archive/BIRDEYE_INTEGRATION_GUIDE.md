# 🔐 Birdeye API Integration Guide

## Current Status: API Key Needs Upgrade

The Birdeye API requires a paid plan to access wallet analytics endpoints.

### Error Received:
```
"Your API key is either suspended or lacks sufficient permissions to access this resource. 
Please check your account status or upgrade to a higher plan. 
For assistance, contact bds.support@birdeye.so."
```

## 📊 Required Birdeye Endpoints

To show comprehensive wallet analytics, we need access to:

1. **`GET /wallet/v2/pnl/multiple`** - Overall wallet PnL
2. **`GET /wallet/v2/current-net-worth`** - Current holdings and net worth  
3. **`GET /wallet/v2/pnl`** - PnL per token
4. **`GET /v1/wallet/tx_list`** - Transaction history

## 💰 Birdeye Pricing

Visit: https://birdeye.so/pricing

- **Free Tier**: Limited endpoints (basic token data only)
- **Pro Plan**: ~$99-299/month - Includes wallet analytics
- **Enterprise**: Custom pricing

## 🔧 Setup Instructions

### 1. Get a Valid Birdeye API Key

1. Go to https://birdeye.so/
2. Sign up / Log in
3. Upgrade to Pro plan (wallet endpoints require paid plan)
4. Get your API key from the dashboard

### 2. Add to Environment Variables

Add to `/backend/.env`:
```bash
BIRDEYE_API_KEY=your_actual_birdeye_api_key_here
```

### 3. Restart Backend

```bash
cd backend
npm run dev
```

### 4. Test the New Endpoint

```bash
curl http://localhost:3001/api/wallet/YOUR_WALLET_ADDRESS/analytics
```

## 📋 What the Integration Provides

Once Birdeye API is properly configured, the wallet modal will show:

### ✅ Comprehensive Wallet Analytics:

1. **Overall Performance**
   - Total PnL across all tokens
   - PnL percentage
   - Total invested
   - Total realized
   - Total unrealized PnL

2. **Portfolio Details**
   - Current net worth in USD
   - Token holdings with values
   - Number of tokens held
   - SOL balance

3. **Trading Statistics**
   - Win rate %
   - Number of winning trades
   - Number of losing trades
   - Total trades count
   - Average hold time

4. **Per-Token Breakdown**
   - PnL for each token traded
   - Entry/exit prices
   - Holding period
   - Return percentage

5. **Transaction History**
   - Recent buys/sells
   - Transaction timestamps
   - Trade amounts
   - Token details

## 🎯 Frontend Integration

The WalletModal will automatically use Birdeye data when available:

```javascript
// Frontend will call:
const response = await fetch(`/api/wallet/${walletAddress}/analytics`);
const data = await response.json();

// Response structure:
{
  success: true,
  wallet: "address...",
  pnl: {
    // Overall PnL data
    totalPnL: 5000,
    totalPnLPercent: 45.2,
    totalInvested: 11000,
    totalRealized: 16000,
    winRate: 65.5,
    // ... more stats
  },
  netWorth: {
    // Current holdings
    totalValue: 8500,
    tokens: [...],
    // ... portfolio data
  },
  pnlPerToken: {
    // Token-by-token breakdown
    tokens: [...]
  },
  recentTransactions: {
    // Latest trades
    transactions: [...]
  }
}
```

## 🆓 Alternative: Free Option

If Birdeye is too expensive, we can use:

### **Helius API** (Free Tier: 100k requests/month)

1. Sign up at https://helius.dev/
2. Get free API key
3. Parse transaction history to calculate stats
4. Takes more development but is FREE

Would you like me to implement the Helius alternative instead?

## 🔄 Current Implementation

The code is ready to use Birdeye:

- ✅ `BirdeyeWalletService` created (`/backend/services/birdeyeWalletService.js`)
- ✅ New endpoint added (`GET /api/wallet/:owner/analytics`)
- ✅ Caching implemented (3-minute TTL)
- ✅ Error handling included
- ⏳ Waiting for valid Birdeye API key

## 🚀 Next Steps

**Option 1: Use Birdeye (Paid)**
1. Purchase Birdeye Pro plan
2. Add API key to `.env`
3. Update WalletModal to use `/analytics` endpoint
4. Test and deploy

**Option 2: Use Helius (Free)**
1. Get free Helius API key
2. I'll create transaction parser service
3. Calculate stats from on-chain data
4. Integrate with WalletModal

Which option would you like to proceed with?
