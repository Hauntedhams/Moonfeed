# 🎨 Visual Reference - Lock Icon Display Logic

## 🔍 When Lock Icons Appear

```
┌──────────────────────────────────────────────────────────────────┐
│                    LOCK ICON DISPLAY MATRIX                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Rugcheck Status  │  Lock %  │  Icon Shown?  │  Color          │
│ ─────────────────────────────────────────────────────────────── │
│  ✅ Verified      │   90%+   │  🔒 YES       │  🟢 Green       │
│  ✅ Verified      │  50-89%  │  🔒 YES       │  🟡 Yellow      │
│  ✅ Verified      │  1-49%   │  🔒 YES       │  🟠 Orange      │
│  ✅ Verified      │    0%    │  ❌ NO        │  -              │
│  ❌ Not Verified  │    -     │  ❌ NO        │  -              │
│  🚨 Honeypot      │    -     │  ⚠️ YES       │  🔴 Red         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Real-World Examples

### Example 1: Highly Secured Coin ✅
```
Coin: BONK
Rugcheck: ✅ Verified
Lock Percentage: 95%
Burn Percentage: 3%

DISPLAY:
┌─────────────────────────────────┐
│ Liquidity: $892,145 🔒          │  ← GREEN lock shown
└─────────────────────────────────┘

Hover Tooltip:
"Liquidity: Locked
 Locked: 95%
 Burned: 3%
 Risk Level: low
 Rugcheck Score: 1500"
```

### Example 2: Partially Secured Coin ⚠️
```
Coin: DOGE
Rugcheck: ✅ Verified
Lock Percentage: 65%
Burn Percentage: 0%

DISPLAY:
┌─────────────────────────────────┐
│ Liquidity: $458,392 🔒          │  ← YELLOW lock shown
└─────────────────────────────────┘

Hover Tooltip:
"Liquidity: Locked
 Locked: 65%
 Risk Level: medium
 Rugcheck Score: 950"
```

### Example 3: Low Security Coin 🔶
```
Coin: PEPE
Rugcheck: ✅ Verified
Lock Percentage: 25%
Burn Percentage: 10%

DISPLAY:
┌─────────────────────────────────┐
│ Liquidity: $234,567 🔒          │  ← ORANGE lock shown
└─────────────────────────────────┘

Hover Tooltip:
"Liquidity: Locked
 Locked: 25%
 Burned: 10%
 Risk Level: high
 Rugcheck Score: 450"
```

### Example 4: Unlocked Liquidity (CLEAN UI) ✨
```
Coin: SHIB
Rugcheck: ✅ Verified
Lock Percentage: 0%
Burn Percentage: 0%

DISPLAY:
┌─────────────────────────────────┐
│ Liquidity: $125,847             │  ← NO icon (clean!)
└─────────────────────────────────┘

Hover Tooltip:
"Liquidity: Unlocked
 Risk Level: high
 Rugcheck Score: 200"
```

### Example 5: Not Yet Verified (CLEAN UI) ⏳
```
Coin: NEWCOIN
Rugcheck: ❌ Not Verified
Lock Percentage: -
Burn Percentage: -

DISPLAY:
┌─────────────────────────────────┐
│ Liquidity: $45,230              │  ← NO icon (clean!)
└─────────────────────────────────┘

Hover Tooltip:
"Liquidity lock status not verified"
```

### Example 6: HONEYPOT WARNING! 🚨
```
Coin: SCAM
Rugcheck: ✅ Verified
Is Honeypot: true

DISPLAY:
┌─────────────────────────────────┐
│ Liquidity: $2,345,678 ⚠️        │  ← RED warning shown
└─────────────────────────────────┘

Hover Tooltip:
"⚠️ WARNING: Honeypot Detected
 This token cannot be sold!
 Do not buy this token."
```

---

## 🎯 Icon Color Guide

```
🟢 GREEN Lock (90%+)
   ├─ Highly Secured
   ├─ Very Low Risk
   └─ Safe to Trade

🟡 YELLOW Lock (50-89%)
   ├─ Moderately Secured
   ├─ Medium Risk
   └─ Trade with Caution

🟠 ORANGE Lock (1-49%)
   ├─ Partially Secured
   ├─ Higher Risk
   └─ Extra Caution Advised

❌ NO ICON (0%)
   ├─ Not Locked
   ├─ High Risk
   └─ Information Available via Tooltip

🔴 RED Warning (Honeypot)
   ├─ DANGER!
   ├─ Cannot Sell
   └─ DO NOT BUY
```

---

## 🔄 UI Flow Comparison

### OLD UI (Cluttered):
```
┌────────────────────────────────────────────┐
│ TokenA    Liquidity: $892k 🔒 (good)       │
│ TokenB    Liquidity: $458k 🔓 (noise)      │
│ TokenC    Liquidity: $234k 🔓 (noise)      │
│ TokenD    Liquidity: $125k ❓ (noise)      │
│ TokenE    Liquidity: $892k 🔒 (good)       │
│ TokenF    Liquidity: $567k 🔓 (noise)      │
└────────────────────────────────────────────┘
Icons everywhere - hard to spot secured coins!
```

### NEW UI (Clean):
```
┌────────────────────────────────────────────┐
│ TokenA    Liquidity: $892k 🔒 ← Eye drawn here!│
│ TokenB    Liquidity: $458k                 │
│ TokenC    Liquidity: $234k                 │
│ TokenD    Liquidity: $125k                 │
│ TokenE    Liquidity: $892k 🔒 ← Eye drawn here!│
│ TokenF    Liquidity: $567k                 │
└────────────────────────────────────────────┘
Only secured coins stand out - much cleaner!
```

---

## 💡 Design Principles

### 1. **Show What Matters**
```
✅ SHOW: Locked liquidity (security signal)
✅ SHOW: Honeypot warnings (critical danger)
❌ HIDE: Unlocked liquidity (default state)
❌ HIDE: Unknown status (not meaningful yet)
```

### 2. **Reduce Cognitive Load**
```
BEFORE: User sees 10 icons, must process each
AFTER:  User sees 2 icons, immediately understands
```

### 3. **Progressive Disclosure**
```
ICON:    Quick visual signal (locked/warning)
         ↓
HOVER:   Detailed information (percentages, scores)
         ↓
CLICK:   Full rugcheck report (if needed)
```

---

## 📱 Mobile Considerations

On small screens, icons matter even more:

```
Mobile View (Before):
┌────────────────┐
│ Liq: $892k 🔒  │  ← Cluttered
│ Liq: $458k 🔓  │
│ Liq: $234k ❓  │
└────────────────┘

Mobile View (After):
┌────────────────┐
│ Liq: $892k 🔒  │  ← Clean, easy to scan
│ Liq: $458k     │
│ Liq: $234k     │
└────────────────┘
```

---

## 🎨 CSS Classes (For Reference)

The component uses these classes:

```css
.liquidity-lock-indicator {
  /* Base styles */
}

.liquidity-lock-indicator.locked-high {
  /* Green lock - 90%+ */
  color: #00ff88;
}

.liquidity-lock-indicator.locked-medium {
  /* Yellow lock - 50-89% */
  color: #ffaa00;
}

.liquidity-lock-indicator.locked-low {
  /* Orange lock - 1-49% */
  color: #ff6600;
}

.liquidity-lock-indicator.honeypot {
  /* Red warning - Honeypot */
  color: #ff4444;
}

.liquidity-lock-indicator.unlocked,
.liquidity-lock-indicator.unknown {
  /* These classes won't render - component returns null */
}
```

---

## ✅ Quick Reference

**Show Icon When:**
- ✅ Liquidity is locked (any percentage > 0)
- ✅ Token is a honeypot (critical warning)

**Hide Icon When:**
- ❌ Liquidity is unlocked (0%)
- ❌ Rugcheck not verified yet (unknown)

**Tooltip Always Works:**
- ✅ On hover, detailed info shows regardless of icon

---

## 🚀 Testing Quick Guide

1. **Start frontend:** `npm run dev`
2. **Check coins with:**
   - Locked liquidity → Should see 🔒
   - Unlocked liquidity → Should see NO icon
   - Honeypot → Should see ⚠️

3. **Hover over liquidity:**
   - All coins should show tooltip
   - Tooltip has full details

4. **Expected result:**
   - Cleaner UI ✅
   - Icons only where meaningful ✅
   - Easy to spot secured coins ✅

---

**🎉 Clean, meaningful, user-friendly!**
