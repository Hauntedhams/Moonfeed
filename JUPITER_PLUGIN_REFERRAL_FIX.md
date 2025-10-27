# 🎯 Jupiter Plugin Referral Configuration

## Overview

Your app uses the **Jupiter Terminal Plugin** for swaps, not the Trigger API. The referral configuration is different for the Plugin.

## ✅ FIXED - Plugin Referral Configuration

### What Was Changed

Updated `/frontend/src/components/JupiterTradeModal.jsx` to include referral parameters in the Plugin initialization:

```javascript
window.Jupiter.init({
  displayMode: "integrated",
  integratedTargetId: "jupiter-container",
  endpoint: "https://api.mainnet-beta.solana.com",
  
  formProps: {
    initialOutputMint: coin.mintAddress,
    initialInputMint: "So11111111111111111111111111111111111111112",
    
    // 💰 REFERRAL FEE CONFIGURATION (1%)
    referralAccount: "42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt",
    referralFee: 100, // 100 BPS = 1%
  },
  // ...
});
```

### Key Points

1. **For Plugin**: Use `referralAccount` and `referralFee` in `formProps`
2. **For Trigger API**: Use `feeAccount` and `params.feeBps` (different approach)
3. **Your wallet**: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
4. **Fee**: 100 BPS = 1%

## Why You See 0.1%

**Important**: The Jupiter UI will likely still show 0.1% because:
- That's Jupiter's platform fee (their cut)
- Your 1% referral fee is on top of that
- Jupiter's UI doesn't always display partner fees separately
- Total user pays: ~1.1%

## How to Verify

1. **Check Browser Console**: After initialization, look for Jupiter logs
2. **Inspect Transaction**: When a swap completes, check the on-chain transaction
3. **Monitor Wallet**: Watch `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt` for incoming tokens

## Next Steps

1. ✅ **Plugin configured** - Referral added to frontend
2. ⏳ **Test a swap** - Create a small test swap
3. ⏳ **Verify fees** - Check if fees appear in your wallet after swap
4. ⏳ **Monitor** - Track incoming referral payments

## For Limit Orders (Trigger API)

**Note**: If you're also using the Trigger API for limit orders, you'll need to implement the separate Trigger API referral system as documented in:
- `JUPITER_REFERRAL_IMPLEMENTATION_GUIDE.md`
- `JUPITER_REFERRAL_CHECKLIST.md`

These are two different systems:
- **Plugin** (instant swaps) - Uses `referralAccount` + `referralFee`
- **Trigger API** (limit orders) - Uses `feeAccount` + `params.feeBps`

## Resources

- [Jupiter Plugin Docs](https://dev.jup.ag/tool-kits/plugin)
- [Plugin Customization](https://dev.jup.ag/tool-kits/plugin/customization)
- [Referral Dashboard](https://referral.jup.ag/)

## Status

✅ **Jupiter Plugin referral configured**
⏳ **Awaiting test swap to verify fee collection**

---

**Previous docs** (`JUPITER_REFERRAL_IMPLEMENTATION_GUIDE.md`, etc.) apply to **Trigger API only**, not the Plugin.
