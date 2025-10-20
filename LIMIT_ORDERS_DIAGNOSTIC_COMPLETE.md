# Limit Orders Diagnostic Report - Complete Analysis

## Executive Summary

The limit orders system is **mostly functional** but has several **critical UX issues** around transparency, expiration handling, and fund flow clarity. The backend correctly integrates with Jupiter's Trigger API, but the frontend display and user education need significant improvements.

---

## 🔍 Current System Architecture

### Backend (`jupiterTriggerService.js`)
**Status: ✅ Functional (with enrichment logic in place)**

The backend correctly:
- Creates limit orders via Jupiter Trigger API v1
- Cancels orders (single and batch)
- Executes signed transactions
- Fetches orders with status filtering (active/history)
- **Enriches orders with**:
  - Token metadata (symbol, name, decimals) from Jupiter and Solscan APIs
  - Current price from Jupiter Price API
  - Transaction signatures (create, update, cancel, execute)
  - Calculated trigger prices and amounts
  - Proper timestamp handling (ISO format conversion)

### Frontend (`ProfileView.jsx`)
**Status: ⚠️ Partially Functional (UX issues)**

The frontend correctly:
- Displays active/history tabs
- Shows order details with price comparison
- Handles order cancellation with wallet signing
- Filters expired orders client-side
- Shows prominent expiration warnings
- Links to Solscan for transaction verification

---

## 🚨 Critical Issues Identified

### 1. **Fund Flow Transparency - MAJOR UX GAP**

**Problem**: Users don't understand where their funds go after placing a limit order.

**Current Behavior**:
- ✅ When you place a limit order, funds are transferred to Jupiter's escrow program
- ❌ **The UI never explains this to users**
- ❌ No indication of which account holds the funds
- ❌ No clear explanation that funds are NOT returned automatically on expiration

**What Actually Happens**:
1. User places order → Funds leave wallet → Sent to Jupiter escrow (PDA)
2. Order expires → Funds **stay in escrow** (NOT returned automatically)
3. User must manually **cancel the order** to retrieve funds from escrow

**Jupiter Escrow Program Details**:
- **Program ID**: `jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu` (Jupiter Limit Order Program)
- Funds are held in a **Program Derived Address (PDA)** specific to each order
- The PDA is derived from: `[maker_wallet, order_id]`
- Only the maker can cancel and retrieve funds

**Where This Should Be Shown**:
- ⚠️ **Before order creation**: Warning dialog explaining escrow
- ⚠️ **Active order card**: "Funds held in Jupiter escrow - Account: [shortened PDA]"
- ⚠️ **Expired orders**: "URGENT: Funds are still in escrow - Cancel to retrieve"

---

### 2. **Expiration Logic - CRITICAL BUG**

**Problem**: Expired orders still show in "Active" tab and are not automatically updated.

**Root Cause Analysis**:

```javascript
// ProfileView.jsx line 110-130
if (statusFilter === 'active') {
  const activeOrders = [];
  const expiredOrders = [];
  
  fetchedOrders.forEach(order => {
    if (isOrderExpired(order)) {
      expiredOrders.push(order);
    } else {
      activeOrders.push(order);
    }
  });
  
  // CLIENT-SIDE FILTERING works correctly
  setOrders(activeOrders);
}
```

**The Good News**: Client-side filtering **is working** - expired orders are removed from active tab.

**The Problem**: 
- Jupiter API **still returns expired orders** in the "active" status response
- Frontend filters them out, but this is inconsistent
- Users see orders "disappear" without explanation
- **Expired orders don't automatically move to "history" tab**

**Jupiter API Behavior**:
- `/getTriggerOrders?orderStatus=active` returns orders with status "active" **regardless of expiration**
- The API does NOT filter by `expiredAt` timestamp
- It's the client's responsibility to check expiration

**Solution Needed**:
1. Keep client-side filtering for active tab
2. Add a **"Recently Expired"** section in history tab
3. Show clear message: "This order expired on [date] and was automatically hidden from active orders"

---

### 3. **Inaccurate Order Information**

**Problem**: Several data points shown to users are incorrect or misleading.

#### Issue 3A: "No expiry" shown when expiry WAS set
**Location**: ProfileView.jsx line 576

```javascript
let expiryText = 'No expiry';

if (isExpired) {
  expiryText = '⚠️ EXPIRED';
} else if (hoursUntilExpiry !== null) {
  expiryText = hoursUntilExpiry > 0 ? `${hoursUntilExpiry}h ${minutesUntilExpiry}m` : `${minutesUntilExpiry}m`;
}
```

**The Bug**: If `expiresAt` is `null` (not set), the default "No expiry" is correct. However:
- Backend enrichment **does convert** Jupiter's timestamps to ISO format
- Sometimes `expiresAt` is an empty string `""` or invalid date, which fails validation
- Frontend then defaults to "No expiry" even when an expiry was originally set

**Evidence From Your Transaction**:
Looking at Solscan transaction `3kRRHN6V...`, the order **does have an expiry** set (10 days from Oct 18, 2025).

**Root Cause**: Timestamp validation is too strict:

```javascript
// ProfileView.jsx line 541-555
if (expiresAt) {
  try {
    const testDate = new Date(expiresAt);
    if (isNaN(testDate.getTime())) {
      console.warn('Invalid expiresAt timestamp:', expiresAt);
      expiresAt = null;  // ❌ Sets to null, losing the data
    }
  } catch (err) {
    console.error('Error parsing expiresAt:', err);
    expiresAt = null;
  }
}
```

**Fix**: Instead of setting to `null`, keep the raw value and show "Invalid expiry format" or parse more aggressively.

#### Issue 3B: Current Price = Trigger Price (always equal)
**Location**: Backend jupiterTriggerService.js line 483-510

```javascript
// Fetch current price from Jupiter Price API
let currentPrice = null;
try {
  const priceResponse = await axios.get(
    `https://api.jup.ag/price/v2?ids=${tokenMint}`,
    { timeout: 3000 }
  );
  
  if (priceResponse.data?.data?.[tokenMint]) {
    currentPrice = parseFloat(priceResponse.data.data[tokenMint].price) || null;
  }
} catch (priceError) {
  console.log(`[Jupiter Trigger] Could not fetch current price for ${tokenMint}`);
}

// Fallback: If no current price, use trigger price as estimate
if (!currentPrice || currentPrice === 0) {
  currentPrice = triggerPrice;  // ❌ FALLBACK BEING USED TOO OFTEN
}
```

**The Problem**:
- Jupiter Price API v2 returns prices **in USD**, not SOL
- Trigger prices are calculated **in SOL per token**
- Comparing USD price to SOL price = **meaningless**
- Fallback uses `triggerPrice`, making them **always equal**

**Evidence**: In the UI screenshot you provided:
- Current Price: $0.000012
- Trigger Price: $0.000012
- **This is the fallback in action** - the API call failed or returned incompatible data

**Fix**: 
1. Use Jupiter Price API to get **USD price**
2. Fetch **SOL/USD rate** from Jupiter
3. Calculate: `currentPriceSOL = currentPriceUSD / solUsdRate`
4. OR: Use Birdeye/Dexscreener for SOL-denominated prices

#### Issue 3C: Coin Name Not Showing
**Location**: Backend jupiterTriggerService.js line 341-365

```javascript
// Fetch token metadata for accurate symbol and decimals
let tokenSymbol = null;
let tokenName = null;

try {
  const tokenResponse = await axios.get(
    `https://tokens.jup.ag/token/${tokenMint}`,
    { timeout: 5000 }
  );
  
  if (tokenResponse.data) {
    tokenSymbol = tokenResponse.data.symbol || null;
    tokenName = tokenResponse.data.name || null;
  }
} catch (tokenError) {
  console.log(`[Jupiter Trigger] Could not fetch token metadata for ${tokenMint}`);
}
```

**The Problem**: 
- Jupiter's `/token/` endpoint may not have all tokens
- Fallback to Solscan API exists, but may also fail for new/obscure tokens
- Final fallback uses shortened mint address: `3wXx...Yz5q`

**Current Behavior**: Works for major tokens, fails for meme coins not in Jupiter's registry.

**Fix**: Add additional fallback to:
1. Dexscreener API (`/tokens/solana/${tokenMint}`)
2. On-chain metadata parsing (using `@metaplex-foundation/mpl-token-metadata`)

---

### 4. **Transaction Signature Extraction Issues**

**Problem**: Not all transaction signatures are being captured from Jupiter API responses.

**Location**: Backend jupiterTriggerService.js line 515-548

```javascript
const createTxSignature = 
  order.createTxSignature || 
  account.createTxSignature || 
  order.createTx || 
  account.createTx ||
  order.signature || 
  account.signature ||
  null;
```

**The Issue**: Jupiter's API response structure varies:
- **Active orders**: Data in `order.account` object
- **History orders**: Data directly in `order` object
- **Different API versions**: Field names change (`createTxSignature` vs `createTx`)

**Evidence**: The code tries multiple field names, which is good, but **logging shows signatures are often `null`**.

**Why This Happens**:
- Jupiter API **does not always include transaction signatures** in `/getTriggerOrders` response
- Signatures are **only available in real-time** during order creation/cancellation
- Historical orders may not have signatures stored

**Workaround**: 
- Store signatures in **your own database** when user creates/cancels orders
- Or: Parse order account on-chain to extract transaction history

---

## 🎯 Recommended Fixes (Priority Order)

### Priority 1: Fund Flow Transparency (CRITICAL UX)

**Before Order Creation Modal** - Add warning:
```
⚠️ ESCROW NOTICE
When you place this limit order:
• Your [X] SOL will be sent to Jupiter's escrow program
• Funds are held in a secure Program Derived Address (PDA)
• Order expires in [X] days - funds do NOT return automatically
• You MUST cancel the order to retrieve your funds from escrow

Escrow Account: [PDA address]
Jupiter Program: jupoNjAx...Nrnu
```

**Active Order Card** - Show escrow details:
```javascript
// Add to ProfileView.jsx order card
<div className="escrow-info-badge">
  <span className="escrow-icon">🔒</span>
  <span>Funds in Jupiter Escrow</span>
  <a href={`https://solscan.io/account/[PDA]`} target="_blank">
    View Account ↗
  </a>
</div>
```

**Expired Order Warning** - Already implemented well, but enhance:
```
⚠️ ORDER EXPIRED - FUNDS LOCKED IN ESCROW

This order expired on [date]. Your [X] SOL is currently held in 
Jupiter's escrow account and will NOT be returned automatically.

Escrow Account: [PDA shortened]

⚡ You must cancel this order to retrieve your funds!

[CANCEL & RETRIEVE FUNDS - prominent button]
```

---

### Priority 2: Fix Expiration Logic

**Backend Enhancement** - Add expiration check to orders endpoint:
```javascript
// backend/routes/trigger.js
router.get('/orders', async (req, res) => {
  const result = await jupiterTriggerService.getTriggerOrders({
    wallet,
    orderStatus: status,
    page: parseInt(page)
  });

  // Server-side expiration flagging
  if (result.success && result.orders) {
    result.orders = result.orders.map(order => ({
      ...order,
      isExpiredServer: order.expiresAt ? new Date(order.expiresAt) < new Date() : false
    }));
  }

  res.json(result);
});
```

**Frontend Enhancement** - Show "Recently Expired" section in history:
```javascript
// ProfileView.jsx
{statusFilter === 'history' && (
  <>
    {/* Recently Expired Orders - Last 7 days */}
    <div className="recently-expired-section">
      <h4>⏰ Recently Expired (Last 7 Days)</h4>
      {recentlyExpiredOrders.map(order => (
        // Render with special "expired but not cancelled" styling
      ))}
    </div>
    
    {/* Executed Orders */}
    {/* Cancelled Orders */}
  </>
)}
```

---

### Priority 3: Fix Price Comparison

**Backend Fix** - Get SOL-denominated prices:
```javascript
// Option 1: Use Jupiter Price API correctly
async function getCurrentPriceInSOL(tokenMint) {
  // Get token price in USD
  const tokenUSD = await getJupiterPriceUSD(tokenMint);
  
  // Get SOL price in USD
  const solUSD = await getJupiterPriceUSD('So11111111111111111111111111111111111111112');
  
  // Convert: tokenSOL = tokenUSD / solUSD
  return tokenUSD / solUSD;
}

// Option 2: Use Birdeye API (better for SOL pairs)
const response = await axios.get(
  `https://public-api.birdeye.so/public/price?address=${tokenMint}`,
  {
    headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY }
  }
);
// Birdeye returns price in SOL natively for SOL pairs
```

---

### Priority 4: Enhanced Token Metadata

**Add Dexscreener Fallback**:
```javascript
// After Jupiter and Solscan attempts fail
if (!tokenSymbol) {
  try {
    const dexResponse = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`,
      { timeout: 5000 }
    );
    
    if (dexResponse.data?.pairs?.[0]) {
      const pair = dexResponse.data.pairs[0];
      tokenSymbol = pair.baseToken.symbol;
      tokenName = pair.baseToken.name;
    }
  } catch (e) {
    console.log('Dexscreener fallback failed');
  }
}
```

---

### Priority 5: Transaction Signature Storage

**Backend Database Schema** (if you add a DB):
```sql
CREATE TABLE limit_orders (
  order_id VARCHAR(88) PRIMARY KEY,
  wallet_address VARCHAR(44) NOT NULL,
  token_mint VARCHAR(44) NOT NULL,
  create_tx_signature VARCHAR(88),
  cancel_tx_signature VARCHAR(88),
  execute_tx_signature VARCHAR(88),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store signatures when user creates/cancels orders
-- This ensures you always have them for display
```

**Or Simpler: LocalStorage Cache**:
```javascript
// When order is created
const orderData = {
  orderId: result.orderId,
  createTxSignature: result.signature,
  walletAddress: publicKey.toString()
};

localStorage.setItem(
  `order_${result.orderId}`,
  JSON.stringify(orderData)
);

// When fetching orders, merge with stored data
const storedOrder = JSON.parse(
  localStorage.getItem(`order_${order.orderId}`)
);

if (storedOrder?.createTxSignature) {
  order.createTxSignature = storedOrder.createTxSignature;
}
```

---

## 📊 Order Lifecycle - Complete Flow

### 1. Order Creation
```
User Action:
  → Click "Create Limit Order" on CoinCard
  → Enter amount, trigger price, expiration
  → Click "Place Order"

Backend:
  → POST /api/trigger/create-order
  → jupiterTriggerService.createOrder()
  → Jupiter API: POST /createOrder
  → Returns: { transaction, requestId }

Frontend:
  → Decode transaction (versioned or legacy)
  → Wallet signs transaction
  → POST /api/trigger/execute { signedTransaction, requestId }

Blockchain:
  → Transaction submitted to Solana
  → Funds transferred from user wallet → Jupiter PDA escrow
  → Order account created on-chain
  → Transaction finalized

Result:
  ✅ Order created with status "active"
  🔒 Funds held in escrow at: PDA([maker, order_id])
  📝 Transaction signature: [createTxSignature]
```

### 2. Order Active (Monitoring)
```
Jupiter's Backend:
  → Continuously monitors token price
  → Compares current price vs trigger price
  → When trigger condition met:
    - Executes swap via Jupiter Aggregator
    - Updates order status to "executed"
    - Sends tokens to user wallet
```

### 3. Order Expiration
```
When expiredAt timestamp passes:
  → Order status remains "active" in Jupiter API response
  → BUT: Order is no longer being monitored for execution
  → Funds REMAIN in escrow (NOT automatically returned)

User MUST:
  → Manually cancel order via UI
  → Sign cancel transaction
  → Funds returned from PDA escrow → user wallet
```

### 4. Order Cancellation
```
User Action:
  → Click "Cancel Order"

Backend:
  → POST /api/trigger/cancel-order { maker, orderId }
  → jupiterTriggerService.cancelOrder()
  → Jupiter API: POST /cancelOrder
  → Returns: { transaction, requestId }

Frontend:
  → Decode cancel transaction
  → Wallet signs transaction
  → POST /api/trigger/execute { signedTransaction, requestId }

Blockchain:
  → Cancel transaction executed
  → Funds returned from PDA escrow → user wallet
  → Order account closed
  → Rent reclaimed

Result:
  ✅ Order status: "cancelled"
  💰 Funds returned to user wallet
  📝 Transaction signature: [cancelTxSignature]
```

### 5. Order Execution (Trigger Met)
```
Jupiter's Backend (Automatic):
  → Detects trigger price reached
  → Fetches best swap route via Jupiter Aggregator
  → Executes swap transaction:
    - Takes funds from PDA escrow
    - Swaps via optimal route (Raydium, Orca, etc.)
    - Sends output tokens to user wallet
  → Updates order status to "executed"

Result:
  ✅ Order status: "executed"
  💱 Swap completed at trigger price (or better)
  📝 Transaction signature: [executeTxSignature]
  🎉 User receives tokens in wallet
```

---

## 🔧 Code Locations Reference

### Backend
- **Service**: `/backend/services/jupiterTriggerService.js`
  - `createOrder()` - Line 18-97
  - `getTriggerOrders()` - Line 275-625
  - Token enrichment - Line 341-425
  - Price fetching - Line 483-510
  - Signature extraction - Line 515-548

- **Routes**: `/backend/routes/trigger.js`
  - GET `/api/trigger/orders` - Line 165-186
  - POST `/api/trigger/create-order` - Line 14-54
  - POST `/api/trigger/cancel-order` - Line 99-126

### Frontend
- **Component**: `/frontend/src/components/ProfileView.jsx`
  - Order fetching - Line 90-150
  - Order display - Line 520-805
  - Expiration logic - Line 76-88, 110-140
  - Cancel handler - Line 153-270
  - Expired order warning - Line 623-650

---

## ✅ What's Working Well

1. **Order Creation Flow**: Smooth UX, proper wallet integration
2. **Transaction Signing**: Handles both versioned and legacy transactions
3. **Cancel Functionality**: Works correctly, returns funds
4. **Expired Order Detection**: Client-side filtering is accurate
5. **Solscan Links**: All transactions link to explorer
6. **Visual Warnings**: Prominent red banners for expired orders
7. **Token Enrichment**: Attempts multiple API sources for metadata

---

## ❌ What Needs Fixing

1. **Fund Flow Transparency**: No explanation of escrow mechanics
2. **Price Comparison**: USD vs SOL mismatch makes it meaningless
3. **Expiration UX**: Orders disappear without explanation
4. **Token Metadata**: Fails for obscure meme coins
5. **Transaction Signatures**: Not all signatures captured/stored
6. **Timestamp Display**: "No expiry" shown when expiry exists

---

## 📝 Testing Checklist

To verify fixes, test these scenarios:

- [ ] Create limit order → Verify escrow warning shown
- [ ] Check active order → Verify PDA account link displayed
- [ ] Wait for expiration → Verify order shows in "Recently Expired" section
- [ ] Cancel expired order → Verify funds returned from escrow
- [ ] Create order for obscure meme coin → Verify name/symbol fetched
- [ ] Compare current vs trigger price → Verify both in same denomination (SOL)
- [ ] Check transaction signatures → Verify all present (create/cancel/execute)
- [ ] Test with 24hr expiration → Verify countdown displays correctly

---

## 🎯 Next Steps

**Immediate (Do Not Commit Yet)**:
1. Review this diagnostic with stakeholders
2. Decide on priority order for fixes
3. Design escrow warning modal (mockup/wireframe)
4. Test current price API behavior with various tokens
5. Verify Jupiter API response structure for your wallet's orders

**Phase 1 Implementation** (Escrow Transparency):
1. Add escrow warning before order creation
2. Display PDA account in active order card
3. Enhance expired order warnings with escrow details
4. Add FAQ section explaining fund flow

**Phase 2 Implementation** (Data Accuracy):
1. Fix price comparison (SOL denomination)
2. Add Dexscreener fallback for token metadata
3. Implement transaction signature storage
4. Fix timestamp parsing and display

**Phase 3 Implementation** (UX Polish):
1. Add "Recently Expired" section in history
2. Show order lifecycle timeline
3. Add bulk cancel for multiple expired orders
4. Implement order notifications (browser push)

---

## 🤔 Open Questions

1. **Should expired orders auto-cancel after X days?**
   - Pro: User doesn't lose funds forever
   - Con: Requires additional transaction fees
   
2. **Should we store order data in our own database?**
   - Pro: Better transaction signature tracking
   - Con: More infrastructure complexity
   
3. **Should we show estimated gas fees for cancel transactions?**
   - Pro: User knows cost before cancelling
   - Con: Adds complexity to UI

4. **Should we warn users about price impact on execution?**
   - Jupiter executes at best available price, which may differ from trigger
   - Slippage tolerance settings?

---

## 📚 Resources

- [Jupiter Limit Order Docs](https://station.jup.ag/docs/limit-order/overview)
- [Jupiter Trigger API v1 Spec](https://lite-api.jup.ag/docs/static/index.html)
- [Solana PDA Documentation](https://solanacookbook.com/core-concepts/pdas.html)
- [Jupiter Program Explorer](https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu)

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Diagnostic Complete - Awaiting Implementation Approval
