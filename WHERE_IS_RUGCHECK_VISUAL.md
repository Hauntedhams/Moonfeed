# 🔍 Where to Find Rugcheck Security Data - Visual Guide

## Step-by-Step Location

```
┌─────────────────────────────────────┐
│  📱 COIN CARD                       │
│                                     │
│  🌙 MOONCOIN                        │
│  $0.00001234                        │
│  ▲ 45.2% 24h                        │
│                                     │
│  ┌─────────┬─────────┬─────────┐  │
│  │ 💧 Liq  │ 📊 Vol  │ 👥 Hold │  │  ← METRICS ROW
│  │ $123K   │ $45K    │ 1,234   │  │
│  └────┬────┴─────────┴─────────┘  │
│       │                             │
│       │ TAP HERE! 👆                │
│       └─────────────────────────────┼──────┐
│                                     │      │
│  🎯 Price Actions...                │      │
│                                     │      │
└─────────────────────────────────────┘      │
                                              │
                                              ▼
┌──────────────────────────────────────────────────┐
│  LIQUIDITY MODAL                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                  │
│  💧 Liquidity                                    │
│                                                  │
│  $123,456.78                                     │
│                                                  │
│  The amount of money available for trading.      │
│  Higher liquidity means easier buying/selling    │
│  with less price impact.                         │
│                                                  │
│  There's $123,456.78 available in trading        │
│  pools for MOONCOIN, making it relatively        │
│  easy to trade large amounts.                    │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  🔐 SECURITY ANALYSIS                    │  │ ← RUGCHECK DATA HERE!
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │                                          │  │
│  │  ✅ Liquidity: LOCKED                    │  │
│  │     🔒 Locked: 95%                       │  │
│  │     🔥 Burned: 5%                        │  │
│  │     🛡️ Total Secured: 95%                │  │
│  │                                          │  │
│  │  🟢 Risk Level: LOW                      │  │
│  │  ⭐ Score: 850/5000                      │  │
│  │                                          │  │
│  │  🔑 Token Authorities                    │  │
│  │     ✅ Freeze Authority: Revoked         │  │
│  │     ✅ Mint Authority: Revoked           │  │
│  │                                          │  │
│  │  ✅ Top Holder: 5.2%                     │  │
│  │                                          │  │
│  │  ✅ Verified by Rugcheck API             │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│                 [Close X]                        │
└──────────────────────────────────────────────────┘
```

## What You'll See Based on Rugcheck Status

### 1️⃣ Before Enrichment (Initial Load)
```
┌──────────────────────────────────┐
│  💧 Liquidity                    │
│  $123,456.78                     │
│                                  │
│  [Description text...]           │
│                                  │
│  ┌────────────────────────────┐ │
│  │ ⏳ Security data loading... │ │
│  └────────────────────────────┘ │
└──────────────────────────────────┘
```

### 2️⃣ During Rugcheck (5-8 seconds)
```
┌──────────────────────────────────────┐
│  💧 Liquidity                        │
│  $123,456.78                         │
│                                      │
│  [Description text...]               │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ ⏳ Analyzing security data...│   │
│  │ This may take a few seconds  │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### 3️⃣ Rugcheck Success ✅
```
┌────────────────────────────────────────┐
│  💧 Liquidity                          │
│  $123,456.78                           │
│                                        │
│  [Description text...]                 │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 🔐 SECURITY ANALYSIS             │ │
│  │                                  │ │
│  │ ✅ Liquidity: LOCKED             │ │
│  │    🔒 Locked: 95%                │ │
│  │    🔥 Burned: 5%                 │ │
│  │    🛡️ Total Secured: 95%         │ │
│  │                                  │ │
│  │ 🟢 Risk Level: LOW               │ │
│  │ ⭐ Score: 850/5000               │ │
│  │                                  │ │
│  │ 🔑 Token Authorities             │ │
│  │    ✅ Freeze Authority: Revoked  │ │
│  │    ✅ Mint Authority: Revoked    │ │
│  │                                  │ │
│  │ ✅ Top Holder: 5.2%              │ │
│  │                                  │ │
│  │ ✅ Verified by Rugcheck API      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### 4️⃣ Liquidity UNLOCKED (Warning) ⚠️
```
┌────────────────────────────────────────┐
│  💧 Liquidity                          │
│  $123,456.78                           │
│                                        │
│  [Description text...]                 │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 🔐 SECURITY ANALYSIS             │ │
│  │                                  │ │
│  │ ⚠️ Liquidity: UNLOCKED           │ │ ← RED WARNING
│  │    ⚡ Developers can remove      │ │
│  │       liquidity                  │ │
│  │                                  │ │
│  │ 🔴 Risk Level: HIGH              │ │
│  │ ⚡ Score: 234/5000               │ │
│  │                                  │ │
│  │ 🔑 Token Authorities             │ │
│  │    ❌ Freeze Authority: Active   │ │ ← RED WARNING
│  │    ❌ Mint Authority: Active     │ │ ← RED WARNING
│  │                                  │ │
│  │ ⚠️ Top Holder: 35.8%             │ │ ← RED WARNING
│  │    (High concentration risk)     │ │
│  │                                  │ │
│  │ ✅ Verified by Rugcheck API      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### 5️⃣ HONEYPOT Detected 🚨
```
┌────────────────────────────────────────┐
│  💧 Liquidity                          │
│  $123,456.78                           │
│                                        │
│  [Description text...]                 │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 🔐 SECURITY ANALYSIS             │ │
│  │                                  │ │
│  │ [... other security info ...]    │ │
│  │                                  │ │
│  │ ┌──────────────────────────────┐ │ │
│  │ │ 🚨 HONEYPOT DETECTED         │ │ │ ← CRITICAL WARNING
│  │ │ ⛔ You may not be able to    │ │ │
│  │ │    sell!                     │ │ │
│  │ │ ⛔ DO NOT BUY - Likely scam! │ │ │
│  │ └──────────────────────────────┘ │ │
│  │                                  │ │
│  │ ✅ Verified by Rugcheck API      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### 6️⃣ Rugcheck Failed/Unavailable (Rare)
```
┌──────────────────────────────────────────┐
│  💧 Liquidity                            │
│  $123,456.78                             │
│                                          │
│  [Description text...]                   │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ ℹ️ Advanced security data          │ │
│  │    unavailable                     │ │
│  │                                    │ │
│  │ Check other metrics carefully      │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

## Color Coding System

### 🟢 Green = Good/Safe
- ✅ Liquidity: LOCKED
- ✅ Authorities: Revoked
- 🟢 Risk Level: LOW
- ✅ Top Holder: <10%

### 🟡 Yellow = Caution/Medium Risk
- ⚡ Medium indicators
- 🟡 Risk Level: MEDIUM
- ⚡ Top Holder: 10-20%

### 🔴 Red = Warning/High Risk
- ⚠️ Liquidity: UNLOCKED
- ❌ Authorities: Active
- 🔴 Risk Level: HIGH
- ⚠️ Top Holder: >20%

### 🚨 Critical = Danger/Scam Alert
- 🚨 HONEYPOT DETECTED
- ⛔ DO NOT BUY warnings

## User Flow Diagram

```
User Opens App
      ↓
Scrolls Through Coins
      ↓
Sees Interesting Coin
      ↓
Wants to Check Security
      ↓
👆 TAPS ON "💧 LIQUIDITY" METRIC
      ↓
Modal Opens with Liquidity Info
      ↓
┌─────────────────────┐
│ Waits 0-8 seconds   │ ← Rugcheck API call
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
 SUCCESS        FAIL
    │             │
    ▼             ▼
🔐 SECURITY    ⏳ Analyzing...
ANALYSIS       (will retry)
    │             │
    ↓             │
Makes informed    │
decision          │
    │             │
    └──────┬──────┘
           │
           ▼
    User decides:
    - ✅ Buy (safe)
    - ⚠️ Caution (risky)
    - ❌ Skip (dangerous)
```

## Quick Access Guide

### To See Rugcheck Data:
1. **Find a coin** in your feed
2. **Look at the metrics row** (💧 Liquidity, 📊 Volume, 👥 Holders)
3. **Tap the FIRST metric** (💧 Liquidity)
4. **Wait a few seconds** for rugcheck to load
5. **Scroll down** in the modal to see full security analysis

### Keyboard Shortcut (if applicable):
- Space/Enter on focused coin → Opens liquidity modal

### Mobile Gesture:
- Tap liquidity metric → Opens modal
- Swipe down → Closes modal

## Common Questions

### Q: Why is it in the Liquidity metric?
**A:** Because liquidity lock % is the most important security feature, and it's directly related to liquidity.

### Q: Can I see rugcheck data without opening the modal?
**A:** Not currently - it's only visible in the Liquidity modal to avoid cluttering the card.

### Q: Why does it say "Analyzing..." for so long?
**A:** Rugcheck API can be slow (5-8 seconds). It's a comprehensive security analysis, so it takes time.

### Q: Will it retry if it fails?
**A:** Yes! With the new fix, rugcheck will automatically retry every time you view the coin (if cache expired).

### Q: How long is the data cached?
**A:** 10 minutes. After that, it will re-fetch fresh data.

## Summary

📍 **Location**: Inside the **💧 Liquidity** metric modal  
👆 **Action**: Tap on the Liquidity metric to open it  
⏱️ **Load Time**: 5-8 seconds for rugcheck data  
🔄 **Retries**: Automatic if failed  
💾 **Cache**: 10 minutes  
🎨 **Display**: Color-coded security analysis with all details  

The rugcheck security page is alive and well - it's just integrated into the Liquidity modal! 🎉
