# 🏗️ Jupiter Referral Architecture

## Current (Broken) Flow

```
User Creates Limit Order
         ↓
    Backend API
         ↓
    Jupiter Trigger API
         ↓
  payload = {
    maker: "user_wallet",
    inputMint: "SOL",
    outputMint: "USDC",
    params: {
      makingAmount: "1000",
      takingAmount: "2000"
    },
    referralAccount: "42Dqm..." ❌ (Not recognized)
    feeBps: 100 ❌ (Wrong location)
  }
         ↓
    Order Created
         ↓
    Order Executes
         ↓
    ❌ NO FEE COLLECTED (Wrong parameters)
```

## Correct Flow

```
User Creates Limit Order
         ↓
    Backend API
         ↓
getReferralTokenAccount(outputMint)
         ↓
  Returns: Referral Token Account PDA
  Example: 7x3gTqYj...
         ↓
    Jupiter Trigger API
         ↓
  payload = {
    maker: "user_wallet",
    inputMint: "SOL",
    outputMint: "USDC",
    params: {
      makingAmount: "1000",
      takingAmount: "2000",
      feeBps: "100" ✅ (Inside params)
    },
    feeAccount: "7x3gTqYj..." ✅ (Referral token account)
  }
         ↓
    Order Created
         ↓
    Order Executes
         ↓
    ✅ FEE COLLECTED → Referral Token Account
    ✅ 1% goes to your account
    ✅ User gets remaining amount
```

## Account Structure

```
Admin Wallet
42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
(You control this)
         |
         | Creates & Owns
         ↓
Referral Account (PDA)
<YOUR_REFERRAL_KEY>
(Created via dashboard or SDK)
         |
         | Owns
         ↓
    ┌────┴────┬────────┬────────┐
    ↓         ↓        ↓        ↓
SOL Token  USDC Token  USDT Token  ...more tokens
Account    Account     Account
(PDA)      (PDA)       (PDA)
         
(Fee collection accounts for each token)
```

## How PDAs (Program Derived Addresses) Work

### Referral Account PDA
```
Seeds: [
  "referral",
  project_account (Jupiter's),
  partner (your admin wallet)
]
Program: REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3
Result: Your unique referral account
```

### Referral Token Account PDA
```
Seeds: [
  "referral_ata",
  referral_account (your referral PDA),
  token_mint (SOL/USDC/etc)
]
Program: REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3
Result: Your fee collection account for that token
```

## Complete Flow with Examples

### Setup Phase (One Time)

```
Step 1: Create Referral Account
Dashboard → Connect Wallet → Create Account
Result: ABC123xyz... (Your Referral Account PDA)

Step 2: Create Token Accounts
For SOL:
  Input: Referral Account + SOL Mint
  Output: DEF456uvw... (SOL fee collection account)
  
For USDC:
  Input: Referral Account + USDC Mint
  Output: GHI789rst... (USDC fee collection account)
  
...repeat for each token
```

### Order Execution Phase (Every Order)

```
User: "Buy 1000 USDC with SOL"
         ↓
Backend: Calculate order parameters
  makingAmount: 1000000000 (1 SOL in lamports)
  takingAmount: 1000000000 (1000 USDC in smallest units)
         ↓
Backend: Get referral token account for USDC
  getReferralTokenAccount("USDC_MINT")
  → Returns: GHI789rst... (USDC fee account)
         ↓
Backend: Build payload with fee parameters
  {
    params: { feeBps: "100" },  // 1%
    feeAccount: "GHI789rst..."  // USDC fee account
  }
         ↓
Jupiter: Create order on-chain
         ↓
Jupiter: Order sits in orderbook
         ↓
Jupiter: Order gets filled
  User pays: 1 SOL (~$150)
  User receives: 985.5 USDC (after 1.1% fees)
  Jupiter gets: 1.5 USDC (0.1% platform fee)
  You get: 10 USDC (1% referral fee) ✅
         ↓
Your USDC fee account: +10 USDC 💰
```

## Fee Distribution Breakdown

```
Order: Swap 1 SOL (~$150) for USDC
Expected Output: 1000 USDC

Fee Calculation:
├─ Jupiter Platform Fee (0.1%): 1 USDC
├─ Your Referral Fee (1.0%): 10 USDC
└─ Total Fees: 11 USDC (1.1%)

User Receives: 989 USDC
Jupiter Receives: 1 USDC → Jupiter Treasury
You Receive: 10 USDC → Your USDC Referral Token Account ✅

Your Revenue: 10 USDC
Jupiter Revenue: 1 USDC
You earn: 90.9% of total fees! 🎉
```

## Multiple Token Example

```
Your Referral Account Balances After 100 Orders:

Referral Account: ABC123xyz...
├─ SOL Token Account (DEF456uvw...)
│  Balance: 2.5 SOL
│  From: 25 orders that paid fees in SOL
│
├─ USDC Token Account (GHI789rst...)
│  Balance: 1,250 USDC
│  From: 50 orders that paid fees in USDC
│
├─ USDT Token Account (JKL012mno...)
│  Balance: 500 USDT
│  From: 20 orders that paid fees in USDT
│
└─ Other tokens...
   Balance: Various
   From: Various orders

Total Value: ~$2,000+ in fees from 100 orders
```

## Code Flow

### Helper Module (`/backend/utils/jupiterReferral.js`)

```javascript
getReferralTokenAccount(mintAddress)
         ↓
   Check cache
         ↓
   Cache miss → Calculate PDA
         ↓
findProgramAddressSync([
  "referral_ata",
  referralAccount,
  tokenMint
])
         ↓
   Check on-chain if exists
         ↓
   Cache result
         ↓
   Return token account address
```

### Jupiter Service (`/backend/services/jupiterTriggerService.js`)

```javascript
createOrder(orderParams)
         ↓
   Validate parameters
         ↓
   Build base payload
         ↓
   if (REFERRAL_ACCOUNT) {
     feeAccount = await getReferralTokenAccount(outputMint)
     payload.feeAccount = feeAccount
     payload.params.feeBps = "100"
   }
         ↓
   POST to Jupiter API
         ↓
   Return transaction
```

## Key Concepts

### 1. Program Derived Address (PDA)
- Deterministic address derived from seeds
- No private key (controlled by program)
- Predictable and repeatable
- Used for both referral account and token accounts

### 2. Token Accounts
- Each token needs its own account
- Account is owned by your referral account
- Receives fees when orders execute
- Must be initialized before first use

### 3. Fee Collection
- Automatic when orders execute
- In the token being traded
- No manual claiming needed
- View on Solscan or via RPC

### 4. API Integration
- `feeAccount` = where fees go
- `feeBps` = how much (100 = 1%)
- Must be inside `params` object
- Required for Trigger API

## Monitoring

### Check Individual Token Account
```
https://solscan.io/account/<TOKEN_ACCOUNT_PDA>
Example: https://solscan.io/account/GHI789rst...

View:
- Current balance
- Transaction history
- Incoming fee deposits
```

### Check All Token Accounts
```
https://solscan.io/account/<REFERRAL_ACCOUNT>
Example: https://solscan.io/account/ABC123xyz...

View:
- All owned token accounts
- Total value across all tokens
- Overall fee collection history
```

## Success Indicators

✅ Backend logs show: `[Jupiter Trigger] ✅ Referral fee enabled`
✅ Payload includes `feeAccount` parameter
✅ `feeBps` is inside `params` object
✅ Orders execute successfully
✅ Token account balances increase after order execution
✅ Solscan shows deposit transactions

## Common Issues

### ❌ "Token account does not exist"
- Create via dashboard: https://referral.jup.ag/dashboard
- Or initialize via SDK before first order
- Check if you have SOL for rent (~0.002 SOL)

### ❌ "Invalid referral account"
- Using wallet address instead of referral PDA
- Referral account not created yet
- Wrong public key format

### ❌ "Fee not collected"
- Check `feeAccount` is present in payload
- Verify `feeBps` is inside `params`
- Confirm token account exists for that mint
- Review transaction on Solscan

## Summary

**Current Setup**: Direct wallet → ❌ Doesn't work

**Correct Setup**:
```
Admin Wallet
    ↓ (owns)
Referral Account (PDA)
    ↓ (owns)
Token Accounts (PDAs for each token)
    ↓ (receives)
Fees (1% of each order)
```

**Result**: Automatic fee collection on every limit order! 💰

---

For implementation details, see:
- `JUPITER_REFERRAL_IMPLEMENTATION_GUIDE.md`
- `JUPITER_REFERRAL_CHECKLIST.md`
