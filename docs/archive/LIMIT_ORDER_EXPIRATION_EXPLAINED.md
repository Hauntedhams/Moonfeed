# Jupiter Limit Order Expiration - How It Works 📋

## Your Order Details
- **Amount**: 0.03 SOL
- **Price Target**: Current price + 10%
- **Expiry**: 1 hour
- **Status**: ✅ Order created successfully

## What Happens Now?

### If Price Reaches Your Target WITHIN 1 Hour:
✅ **Order Executes Automatically**
- Jupiter's system monitors the price continuously
- When the token hits your target price (+10%), the order executes instantly
- Your 0.03 SOL gets swapped for the token at your target price
- You receive the tokens in your wallet
- Referral fee (0.7%) is automatically deducted

### If Price Does NOT Reach Target in 1 Hour:
❌ **Order Expires and is Cancelled**
- After 1 hour, if the price hasn't hit +10%, the order automatically expires
- **Your 0.03 SOL stays in your wallet** - you don't lose anything!
- The order is removed from Jupiter's system
- No transaction fees are charged (because no swap happened)
- You can create a new order with different parameters if you want

## Order Expiration Options

You had these choices when creating the order:

| Option | Time Window | Best For |
|--------|-------------|----------|
| **1 hour** | 60 minutes | Quick trades, volatile tokens |
| **24 hours** | 1 day | Day trading, moderate volatility |
| **7 days** | 1 week | ⭐ **Default** - Most popular |
| **30 days** | 1 month | Long-term holds, patient trading |

## Why Use Expiration Times?

### 1. **Prevents Stale Orders**
- Crypto prices change rapidly
- A price that made sense yesterday might not today
- Expiration keeps your strategy fresh

### 2. **Frees Up Capital**
- If order doesn't fill, your SOL isn't "locked" forever
- You can use it for other opportunities

### 3. **Market Conditions Change**
- News, events, or trends might make you reconsider
- Expiration gives you a natural exit point to reassess

## Example Scenarios

### Scenario 1: Order Fills ✅
```
Time: 0:00   - You create order: Buy at $0.0011 (+10%)
Time: 0:23   - Price hits $0.0011
Time: 0:23   - Order executes automatically
Result: You own tokens at your target price!
```

### Scenario 2: Order Expires ⏱️
```
Time: 0:00   - You create order: Buy at $0.0011 (+10%)
Time: 0:45   - Price at $0.00095 (not reached target)
Time: 1:00   - Order expires automatically
Result: Your 0.03 SOL stays in wallet, no fees charged
```

### Scenario 3: Manual Cancel 🛑
```
Time: 0:00   - You create order: Buy at $0.0011 (+10%)
Time: 0:15   - You change your mind and cancel
Result: Order cancelled, SOL returns immediately
```

## Key Points to Remember

### ✅ What's Safe:
- Your SOL is **always** in your wallet
- No transaction fees if order doesn't fill
- You can cancel anytime before expiration
- Expiration is automatic - no action needed

### ⚠️ What to Know:
- Once order fills, **it's final** (like any blockchain transaction)
- Referral fee (0.7%) only charged **if order executes**
- Network fees apply only when order actually executes
- You need enough SOL for both the trade AND network fees

## Managing Your Orders

### View Active Orders:
```javascript
// In the Limit Order tab, you can see:
- Order ID
- Token name
- Target price
- Amount
- Expiration time
- Status (Active/Filled/Expired)
```

### Cancel Before Expiration:
1. Go to Limit Order tab
2. Find your order in "Active Orders"
3. Click "Cancel"
4. Confirm in wallet
5. Order cancelled immediately

## Best Practices

### ✅ DO:
- Set realistic price targets (within market range)
- Use shorter expiry for volatile tokens (1h-24h)
- Use longer expiry for stable targets (7d-30d)
- Check your order status periodically
- Keep extra SOL for network fees

### ❌ DON'T:
- Set prices too far from current market
- Forget about expired orders
- Create multiple duplicate orders
- Use all your SOL (save some for fees)

## Technical Details

### How Jupiter Monitors Your Order:
1. Order stored on-chain (Solana blockchain)
2. Jupiter's trigger system checks price every few seconds
3. When condition met → Transaction automatically submitted
4. Your wallet automatically signs (you approved this when creating order)
5. Swap executes via Jupiter's routing

### Why It's Trustless:
- Your funds **never** leave your wallet until swap executes
- Order logic runs on-chain (transparent, verifiable)
- You can cancel anytime
- No counterparty risk

### Transaction Flow:
```
1. Create Order  → Wallet signs "future transaction" instructions
2. Price Hits    → Jupiter detects condition met
3. Execute       → Pre-signed transaction submitted to Solana
4. Complete      → Tokens appear in your wallet
```

## Comparison with Traditional Limit Orders

### CEX (Centralized Exchange) Limit Orders:
- Your funds held by exchange
- Fills depend on order book depth
- May partially fill
- Can be cancelled anytime

### Jupiter Limit Orders:
- Your funds stay in your wallet ✅
- Fills via DEX liquidity (Jupiter routing)
- **All or nothing** execution (no partial fills)
- Can be cancelled anytime before execution

## FAQ

### Q: What if price goes above +10% but I'm not online?
**A:** Order executes automatically! You don't need to be online or watching.

### Q: Can I have multiple limit orders?
**A:** Yes! You can create as many as you want for different tokens/prices.

### Q: What if I don't have enough SOL for fees when order triggers?
**A:** Order will fail and remain active until it succeeds or expires.

### Q: Can I change my order after creating it?
**A:** No - you must cancel the old order and create a new one.

### Q: Do I pay fees if order expires unfilled?
**A:** No! Only creation requires a tiny signature fee (~0.000005 SOL).

### Q: Can Jupiter guarantee my order fills at exactly +10%?
**A:** Yes, if liquidity exists at that price. Jupiter uses multiple DEXs to find best execution.

---

## Your Next Steps

1. **Check order status** in the Limit Order tab
2. **Wait for price to hit** your +10% target
3. **Monitor in your wallet** - tokens will appear automatically
4. **If it expires** - decide if you want to create a new order

## Need Help?

- View active orders in the "Limit Order" tab
- Cancel orders anytime before expiration
- Check order history on [Solscan](https://solscan.io)
- See real-time price in the coin card

---

**Remember**: Limit orders are a tool for disciplined trading. They help you:
- Buy at your target price (not emotional decisions)
- Set and forget (no constant monitoring)
- Protect capital (no loss if order doesn't fill)

Happy trading! 🚀
