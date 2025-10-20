# 🎨 RUGCHECK TOOLTIP VISUAL REFERENCE

## What Users See When Hovering Over Liquidity

---

### 📱 Scenario 1: SAFE Token (Best Case)

```
┌─────────────────────────────────────────────────┐
│ Liquidity: $125.4K 🔒                          │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│ 🔐 SECURITY ANALYSIS (Rugcheck)                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│                                                  │
│ ✅ LIQUIDITY STATUS: LOCKED                     │
│    🔒 Locked: 95%                               │
│    🔥 Burned: 5%                                │
│    💎 Total Secured: 95%                        │
│                                                  │
│ 🟢 RISK LEVEL: LOW                              │
│ 🌟 Rugcheck Score: 3500/5000                   │
│                                                  │
│ 🔑 TOKEN AUTHORITIES:                           │
│    ✅ Freeze Authority: Revoked                 │
│    ✅ Mint Authority: Revoked                   │
│                                                  │
│ ✅ TOP HOLDER: 5.2% of supply                  │
│                                                  │
│ 📊 DATA COMPARISON:                             │
│    Solana Tracker: $125.4K (shown)             │
│    DexScreener: $130.2K                        │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│ ✅ Verified by Rugcheck API                     │
└─────────────────────────────────────────────────┘
```

**What this means:**
- 🔒 Lock icon visible on card
- Green color scheme
- User can trade safely

---

### ⚠️ Scenario 2: RISKY Token (Medium Risk)

```
┌─────────────────────────────────────────────────┐
│ Liquidity: $45.8K                               │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│ 🔐 SECURITY ANALYSIS (Rugcheck)                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│                                                  │
│ ⚠️ LIQUIDITY STATUS: UNLOCKED                  │
│    ⚡ Developers can remove liquidity           │
│                                                  │
│ 🟡 RISK LEVEL: MEDIUM                           │
│ ⭐ Rugcheck Score: 1200/5000                    │
│                                                  │
│ 🔑 TOKEN AUTHORITIES:                           │
│    ✅ Freeze Authority: Revoked                 │
│    ❌ Mint Authority: Active                    │
│                                                  │
│ ⚡ TOP HOLDER: 15.3% of supply                  │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│ ✅ Verified by Rugcheck API                     │
└─────────────────────────────────────────────────┘
```

**What this means:**
- ❌ NO lock icon on card
- Yellow warnings
- User should be cautious

---

### 🚨 Scenario 3: SCAM Token (Honeypot)

```
┌─────────────────────────────────────────────────┐
│ Liquidity: $250K 🔴                             │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│ 🔐 SECURITY ANALYSIS (Rugcheck)                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│                                                  │
│ ⚠️ LIQUIDITY STATUS: UNLOCKED                  │
│    ⚡ Developers can remove liquidity           │
│                                                  │
│ 🔴 RISK LEVEL: HIGH                             │
│ ⚡ Rugcheck Score: 150/5000                     │
│                                                  │
│ 🔑 TOKEN AUTHORITIES:                           │
│    ❌ Freeze Authority: Active                  │
│    ❌ Mint Authority: Active                    │
│                                                  │
│ ⚠️ TOP HOLDER: 45.8% of supply                 │
│    (High concentration - potential dump risk)   │
│                                                  │
│ 🚨 CRITICAL WARNING: HONEYPOT DETECTED         │
│    ⛔ You may not be able to sell this token!  │
│    ⛔ DO NOT BUY - This is likely a scam!      │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            │
│ ✅ Verified by Rugcheck API                     │
└─────────────────────────────────────────────────┘
```

**What this means:**
- 🔴 Red lock icon on card (warning style)
- Multiple red flags
- Strong warning not to trade

---

### ⏳ Scenario 4: PENDING Token (Still Enriching)

```
┌─────────────────────────────────────────────────┐
│ Liquidity: $78.2K                               │
│                                                  │
│ Liquidity                                        │
│ $78,200                                         │
│                                                  │
│ The amount of money available for trading.      │
│ Higher liquidity means easier buying/selling    │
│ with less price impact.                         │
│                                                  │
│ ⏳ Security data not yet verified               │
│    Rugcheck analysis in progress...             │
└─────────────────────────────────────────────────┘
```

**What this means:**
- ❌ NO lock icon (prevents false signals)
- Basic liquidity info only
- Will update when enrichment completes

---

## 🎯 Icon Display Logic

### Lock Icon Appears:
```javascript
// From LiquidityLockIndicator.jsx
if (coin.liquidityLocked === true) {
  return <div className="lock-icon">🔒</div>; // Green lock
}
if (coin.isHoneypot === true) {
  return <div className="lock-icon danger">🔴</div>; // Red warning
}
return null; // No icon shown
```

### Icon is Hidden When:
- `liquidityLocked === false` (unlocked)
- `liquidityLocked === undefined` (unknown)
- `liquidityLocked === null` (not yet checked)
- Token is still being enriched

This prevents showing a lock icon for unlocked liquidity!

---

## 📊 Risk Level Color Scheme

| Risk Level | Emoji | Color  | Score Range | Meaning |
|-----------|-------|--------|-------------|---------|
| Low       | 🟢    | Green  | 2000-5000   | Safe to trade |
| Medium    | 🟡    | Yellow | 500-2000    | Trade with caution |
| High      | 🔴    | Red    | 0-500       | High risk - avoid |
| Unknown   | ⚪    | Gray   | N/A         | No data yet |

---

## 🎨 Top Holder Warnings

| Percentage | Emoji | Warning Level | Message |
|-----------|-------|---------------|---------|
| 0-10%     | ✅    | Safe          | Good distribution |
| 10-20%    | ⚡    | Caution       | Moderate concentration |
| 20%+      | ⚠️    | Warning       | High concentration - potential dump risk |

---

## 🔍 Authority Status

### Both Revoked (✅ Best Case):
```
✅ Freeze Authority: Revoked
✅ Mint Authority: Revoked
```
**Meaning:** Devs can't freeze wallets or mint more tokens

### One Active (⚠️ Caution):
```
✅ Freeze Authority: Revoked
❌ Mint Authority: Active
```
**Meaning:** Devs can still mint more tokens (dilution risk)

### Both Active (🚨 Danger):
```
❌ Freeze Authority: Active
❌ Mint Authority: Active
```
**Meaning:** Devs have full control - high risk

---

## 💡 Data Source Comparison

Shows when different sources report different liquidity:

```
📊 DATA COMPARISON:
   Solana Tracker: $125.4K (shown)
   DexScreener: $130.2K
```

**Why this matters:**
- Transparency builds trust
- Shows data accuracy
- Helps users verify information
- Explains any discrepancies

---

## ✅ Benefits for Users

### 1. **Instant Risk Assessment**
- Color-coded risk levels
- Clear lock status
- Quick visual indicators

### 2. **Complete Information**
- All 9 Rugcheck fields
- Authority status
- Top holder analysis
- Honeypot detection

### 3. **Informed Decisions**
- Multiple data points
- Context-aware warnings
- Plain language explanations

### 4. **Scam Protection**
- 🚨 Critical honeypot warnings
- 🔴 High risk indicators
- ⚠️ Concentration alerts

---

## 🔄 Hover Experience Flow

```
1. User sees coin card
   ├─ Liquidity: $125K 🔒 (if locked)
   └─ Liquidity: $125K (if unlocked)

2. User hovers over liquidity
   └─ Tooltip expands with full Rugcheck info

3. User reads security analysis
   ├─ Lock status (most important)
   ├─ Risk level & score
   ├─ Authority status
   ├─ Top holder info
   ├─ Honeypot warning (if any)
   └─ Data verification

4. User makes informed decision
   ✅ Buy safely
   ⚠️ Trade cautiously
   🚨 Avoid completely
```

---

## 🎓 Reading the Tooltip

### Top to Bottom Priority:
1. **Lock Status** - Can devs rug pull?
2. **Risk Level** - Overall safety assessment
3. **Authorities** - Dev control level
4. **Top Holder** - Concentration risk
5. **Honeypot** - Critical scam warning
6. **Data Sources** - Verification transparency

### Quick Decision Making:
- ✅ **All green** = Safe to trade
- 🟡 **Some yellow** = Extra caution
- 🔴 **Any red** = High risk
- 🚨 **Honeypot** = NEVER trade

---

## 📝 Summary

**Every piece of Rugcheck API data is now:**
- ✅ Extracted from API
- ✅ Mapped to coin object
- ✅ Displayed in tooltip
- ✅ Styled with clear visual hierarchy
- ✅ Includes user-friendly explanations
- ✅ Shows critical warnings
- ✅ Maintains data transparency

**Lock icon behavior:**
- ✅ Only shows when liquidity IS locked
- ✅ Shows in red for honeypots
- ❌ Hidden for unlocked liquidity
- ❌ Hidden during enrichment

This creates a complete, accurate, and user-friendly security information system!

---

**Status:** Production Ready 🚀  
**Last Updated:** December 2024
