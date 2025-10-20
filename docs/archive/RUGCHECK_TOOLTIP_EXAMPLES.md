# 🎨 Rugcheck Liquidity Tooltip - Visual Examples

## Example 1: Coin with LOCKED Liquidity (Safe) 🔒

```
┌────────────────────────────────────────────────────────────┐
│ Liquidity                                                  │
├────────────────────────────────────────────────────────────┤
│ $458,392                                                   │
├────────────────────────────────────────────────────────────┤
│ The amount of money available for trading. Higher          │
│ liquidity means easier buying/selling with less price      │
│ impact.                                                     │
├────────────────────────────────────────────────────────────┤
│ There's $458,392 available in trading pools for BONK,     │
│ making it relatively easy to trade large amounts           │
│                                                             │
│ 🔒 Liquidity Security: 95% locked/burned                  │
│ ⚠️ Risk Level: low                                         │
│ ✅ Rugcheck Score: 1500                                    │
└────────────────────────────────────────────────────────────┘
```

---

## Example 2: Coin with UNLOCKED Liquidity (Risky) 🔓

```
┌────────────────────────────────────────────────────────────┐
│ Liquidity                                                  │
├────────────────────────────────────────────────────────────┤
│ $125,847                                                   │
├────────────────────────────────────────────────────────────┤
│ The amount of money available for trading. Higher          │
│ liquidity means easier buying/selling with less price      │
│ impact.                                                     │
├────────────────────────────────────────────────────────────┤
│ There's $125,847 available in trading pools for DOGE,     │
│ making it moderately easy to trade large amounts           │
│                                                             │
│ ⚠️ Liquidity Security: Unlocked                            │
│ ⚠️ Risk Level: medium                                      │
│ ✅ Rugcheck Score: 850                                     │
└────────────────────────────────────────────────────────────┘
```

---

## Example 3: Potential HONEYPOT Detected (Danger!) ⚠️

```
┌────────────────────────────────────────────────────────────┐
│ Liquidity                                                  │
├────────────────────────────────────────────────────────────┤
│ $89,234                                                    │
├────────────────────────────────────────────────────────────┤
│ The amount of money available for trading. Higher          │
│ liquidity means easier buying/selling with less price      │
│ impact.                                                     │
├────────────────────────────────────────────────────────────┤
│ There's $89,234 available in trading pools for SCAM,      │
│ making it moderately easy to trade large amounts           │
│                                                             │
│ ⚠️ Liquidity Security: Unlocked                            │
│ ⚠️ Risk Level: high                                        │
│ ✅ Rugcheck Score: 450                                     │
│ ⚠️ WARNING: Potential honeypot detected                    │
└────────────────────────────────────────────────────────────┘
```

---

## Example 4: Partially Locked Liquidity 🔐

```
┌────────────────────────────────────────────────────────────┐
│ Liquidity                                                  │
├────────────────────────────────────────────────────────────┤
│ $312,456                                                   │
├────────────────────────────────────────────────────────────┤
│ The amount of money available for trading. Higher          │
│ liquidity means easier buying/selling with less price      │
│ impact.                                                     │
├────────────────────────────────────────────────────────────┤
│ There's $312,456 available in trading pools for PEPE,     │
│ making it relatively easy to trade large amounts           │
│                                                             │
│ 🔒 Liquidity Security: 65% locked/burned                  │
│ ⚠️ Risk Level: medium                                      │
│ ✅ Rugcheck Score: 1050                                    │
└────────────────────────────────────────────────────────────┘
```

---

## Example 5: New Coin (Not Yet Verified) 📋

```
┌────────────────────────────────────────────────────────────┐
│ Liquidity                                                  │
├────────────────────────────────────────────────────────────┤
│ $45,789                                                    │
├────────────────────────────────────────────────────────────┤
│ The amount of money available for trading. Higher          │
│ liquidity means easier buying/selling with less price      │
│ impact.                                                     │
├────────────────────────────────────────────────────────────┤
│ There's $45,789 available in trading pools for NEWCOIN,   │
│ making it potentially difficult to trade large amounts     │
└────────────────────────────────────────────────────────────┘

(No Rugcheck data yet - enrichment in progress)
```

---

## 🎯 Key Features

### **Color-Coded Risk Levels:**
- 🟢 **Low Risk** = Green indicators, high lock percentage
- 🟡 **Medium Risk** = Yellow/orange indicators, moderate lock
- 🔴 **High Risk** = Red indicators, unlocked or honeypot

### **Information Hierarchy:**
1. **Basic Info** (always shown)
   - Dollar amount
   - Description
   - Trading ease assessment

2. **Security Info** (shown when available)
   - Lock/unlock status
   - Lock percentage
   - Risk level
   - Rugcheck score
   - Warnings

### **Smart Display:**
- Shows only relevant information
- Adapts to data availability
- Clear visual indicators
- No clutter when data isn't available

---

## 📱 How Users Interact

### **Desktop:**
1. **Hover** cursor over the "Liquidity" metric in coin header
2. Tooltip appears immediately
3. Read security information
4. Move cursor away to dismiss

### **Mobile:**
1. **Tap** on the "Liquidity" metric
2. Tooltip appears
3. Read security information
4. Tap elsewhere to dismiss

---

## ⚡ Real-Time Updates

The Rugcheck data in the tooltip is:
- ✅ **Fresh:** Updated every 5 minutes automatically
- ✅ **Accurate:** Pulled directly from Rugcheck API
- ✅ **Fast:** Displayed instantly on hover (no loading)
- ✅ **Cached:** Efficient use of API calls

---

## 🔄 Data Flow Timeline

```
User Opens App
    ↓
T+0s: Coin cards load with basic data
    ↓
T+2s: DexScreener enrichment starts
    ↓
T+12s: DexScreener data available
       Rugcheck enrichment starts
    ↓
T+15s: Rugcheck data available
       ✅ Tooltip ready with full info
    ↓
T+5min: Auto re-enrichment
        Rugcheck data refreshed
    ↓
T+10min: Auto re-enrichment
         Rugcheck data refreshed
    ↓
(continues...)
```

---

## 💡 Pro Tips

### **For Developers:**
- Check `coin.rugcheckVerified` to see if data is available
- All rugcheck fields are optional (graceful degradation)
- Tooltip only shows rugcheck info when verified
- No errors if rugcheck data is missing

### **For Users:**
- 🟢 Green lock = Safer (liquidity is locked)
- 🔴 Red warning = Riskier (unlocked or honeypot)
- Higher Rugcheck score = Generally better
- Always DYOR (Do Your Own Research)!

---

## 🎉 Summary

The rugcheck information seamlessly integrates into the existing liquidity tooltip, providing users with critical security information right where they need it - at a glance, on hover, with no extra clicks or navigation required!
