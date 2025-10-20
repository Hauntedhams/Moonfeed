# ⏰ Limit Orders Expiry Display - Visual Guide

## 🎯 Quick Reference: Expiry States

This guide shows all possible expiry display states in the Limit Orders UI.

---

## 📊 Display States

### **1. Active Order - Days Remaining** ✅
```
┌──────────────────────────────────────┐
│  🟢 BUY BONK                         │
│  Status: Active                      │
├──────────────────────────────────────┤
│  ⏰ Created: 2h 15m ago               │
│  ⏰ Expires: 7d 12h                   │  ← GREEN (safe)
└──────────────────────────────────────┘
```
**Status**: Normal, plenty of time remaining  
**Color**: Green  
**Action**: None needed

---

### **2. Active Order - Hours Remaining** ⚠️
```
┌──────────────────────────────────────┐
│  🔴 SELL WIF                         │
│  Status: Active                      │
├──────────────────────────────────────┤
│  ⏰ Created: 9d 12h ago               │
│  ⏰ Expires: 18h 45m                  │  ← YELLOW (warning)
└──────────────────────────────────────┘
```
**Status**: Less than 24 hours remaining  
**Color**: Yellow/Orange  
**Action**: Consider extending or canceling soon

---

### **3. Active Order - Minutes Remaining** 🚨
```
┌──────────────────────────────────────┐
│  🟢 BUY POPCAT                       │
│  Status: Active                      │
├──────────────────────────────────────┤
│  ⏰ Created: 9d 23h ago               │
│  ⏰ Expires: 45m                      │  ← RED (critical)
└──────────────────────────────────────┘
```
**Status**: Critical - less than 1 hour remaining  
**Color**: Red  
**Action**: Act now! Cancel or let execute

---

### **4. Expired Order** ❌
```
┌──────────────────────────────────────────────────┐
│  🔴 SELL BONK                                    │
│  Status: Active (but expired!)                  │
│  ╔════════════════════════════════════════════╗ │
│  ║ ⚠️ ORDER EXPIRED - FUNDS LOCKED IN ESCROW ║ │
│  ║                                            ║ │
│  ║ This order expired on Jan 15, 2025.       ║ │
│  ║ Your 5.2 SOL are currently held in        ║ │
│  ║ Jupiter's escrow and will NOT be          ║ │
│  ║ returned automatically.                   ║ │
│  ║                                            ║ │
│  ║ 🔒 Escrow: jupoNjAx...Nrnu ↗              ║ │
│  ║ 📦 Order: ABC123...XYZ ↗                  ║ │
│  ║                                            ║ │
│  ║ 🔧 TO RECOVER FUNDS:                      ║ │
│  ║ 1. Visit jup.ag/limit                     ║ │
│  ║ 2. Connect wallet                         ║ │
│  ║ 3. Cancel this order manually             ║ │
│  ║                                            ║ │
│  ║ ⚠️ You must cancel to get your SOL back!  ║ │
│  ╚════════════════════════════════════════════╝ │
├──────────────────────────────────────────────────┤
│  ⏰ Created: 10d 5h ago                          │
│  ⏰ Expires: ⚠️ EXPIRED                           │  ← RED (expired)
└──────────────────────────────────────────────────┘
```
**Status**: Expired - funds locked in escrow  
**Color**: Red background warning banner  
**Action**: **URGENT** - Cancel order to recover funds

---

### **5. Perpetual Order (No Expiry)** ♾️
```
┌──────────────────────────────────────┐
│  🟢 BUY SAMO                         │
│  Status: Active                      │
├──────────────────────────────────────┤
│  ⏰ Created: 5d 8h ago                │
│  ⏰ Expires: No expiry                │  ← NEUTRAL (perpetual)
└──────────────────────────────────────┘
```
**Status**: Perpetual order - no expiration set  
**Color**: Neutral gray  
**Action**: None - order will remain active indefinitely

---

### **6. Parse Error (Invalid Format)** 🐛
```
┌──────────────────────────────────────┐
│  🔴 SELL MYRO                        │
│  Status: Active                      │
├──────────────────────────────────────┤
│  ⏰ Created: 1h 30m ago               │
│  ⏰ Expires: ⚠️ Invalid format        │  ← ORANGE (error)
└──────────────────────────────────────┘
```
**Status**: Data format error - timestamp couldn't be parsed  
**Color**: Orange  
**Action**: Check console logs, contact support if persistent  
**Debug**: Raw value preserved in console for investigation

---

### **7. Parse Error (Unrealistic Date)** 🐛
```
┌──────────────────────────────────────┐
│  🟢 BUY BOME                         │
│  Status: Active                      │
├──────────────────────────────────────┤
│  ⏰ Created: 20m ago                  │
│  ⏰ Expires: ⚠️ Parse error           │  ← ORANGE (error)
└──────────────────────────────────────┘
```
**Status**: Timestamp validation failed (e.g., year 2099)  
**Color**: Orange  
**Action**: Check console logs, contact support  
**Debug**: Sanity check rejected date >10 years from now

---

## 🎨 Color Legend

| Color | Meaning | Time Range | Urgency |
|-------|---------|------------|---------|
| 🟢 **Green** | Safe | >24 hours | Low |
| 🟡 **Yellow** | Warning | 1-24 hours | Medium |
| 🔴 **Red** | Critical | <1 hour or expired | High |
| ⚫ **Gray** | Neutral | No expiry (perpetual) | None |
| 🟠 **Orange** | Error | Parse/validation error | Debug |

---

## 🧪 Timestamp Format Examples

### **Supported Formats**

1. **ISO 8601 String** (Most Common)
   ```javascript
   "2025-10-18T05:16:20Z"
   "2025-10-18T05:16:20.000Z"
   ```
   ✅ Parsed correctly

2. **Unix Timestamp (Seconds)**
   ```javascript
   1729227380
   ```
   ✅ Converted to ISO, then parsed

3. **Unix Timestamp (Milliseconds)**
   ```javascript
   1729227380000
   ```
   ✅ Converted to ISO, then parsed

4. **Null/Undefined**
   ```javascript
   null
   undefined
   ```
   ✅ Displayed as "No expiry" (perpetual order)

5. **Invalid String**
   ```javascript
   "invalid-date"
   "not-a-timestamp"
   ```
   ⚠️ Displayed as "Invalid format"

6. **Unrealistic Date**
   ```javascript
   "2099-01-01T00:00:00Z" (74 years in future)
   "1950-01-01T00:00:00Z" (74 years in past)
   ```
   ⚠️ Displayed as "Parse error"

---

## 🔍 Console Debug Logs

### **Successful Parsing**
```bash
[Order] ✅ Parsed expiry: "2025-10-18T05:16:20Z" → 2025-10-18T05:16:20.000Z
[Order] Time until expiry: 7d 12h
```

### **No Expiry (Perpetual)**
```bash
[Order] No expiry set for order: ABC123
```

### **Parse Error**
```bash
[Order] Could not parse expiresAt: "invalid-date" type: string
[Order] Expiry date is invalid after parsing: NaN
```

### **Unrealistic Date**
```bash
[Order] Expiry date seems unrealistic: 2099-01-01 (years diff: 74)
```

---

## 📱 Mobile View

All expiry states are fully responsive and display correctly on mobile:

```
┌─────────────────────┐
│  🟢 BUY BONK       │
│  Active            │
├─────────────────────┤
│  Expiry:           │
│  ⏰ 7d 12h          │  ← Stacks vertically
└─────────────────────┘
```

---

## 🎯 User Journey Examples

### **Scenario 1: Normal Order Flow**
```
Day 0:  Create order → "Expires: 10d"
Day 5:  Check status → "Expires: 5d"
Day 9:  Check status → "Expires: 18h 30m" (yellow warning)
Day 10: Order expires → "⚠️ EXPIRED" (red banner)
Day 10: Cancel order → Funds recovered ✅
```

### **Scenario 2: Perpetual Order**
```
Day 0:  Create order (no expiry) → "No expiry"
Day 30: Check status → "No expiry"
Day 60: Check status → "No expiry"
        ...order remains active indefinitely
```

### **Scenario 3: Parse Error Recovery**
```
Day 0:  Load orders → "⚠️ Invalid format"
        Check console → "Could not parse expiresAt: ..."
        Copy raw value → Send to support
        Support investigates → Issue resolved
```

---

## 🚀 Implementation Details

### **Countdown Logic**
```javascript
// Days: Show if >24 hours remaining
expiryText = "7d 12h"

// Hours: Show if <24 hours remaining
expiryText = "18h 45m"

// Minutes: Show if <1 hour remaining
expiryText = "45m"

// Expired: Show if past expiry time
expiryText = "⚠️ EXPIRED"
```

### **Warning Thresholds**
- **Green**: >24 hours remaining
- **Yellow**: 1-24 hours remaining
- **Red**: <1 hour remaining OR expired

### **Error Detection**
- Invalid date format → "⚠️ Invalid format"
- Unrealistic date (±10 years) → "⚠️ Parse error"
- Missing data → "No expiry"

---

## ✅ Testing Checklist

- [x] ISO string format (most common)
- [x] Unix timestamp (seconds)
- [x] Unix timestamp (milliseconds)
- [x] Null/undefined (perpetual)
- [x] Invalid string
- [x] Unrealistic date
- [x] Days display (>24h)
- [x] Hours display (<24h)
- [x] Minutes display (<1h)
- [x] Expired state
- [x] Color transitions (green → yellow → red)
- [x] Mobile responsive
- [x] Console debug logs
- [ ] **Real limit orders** (PENDING)

---

## 🔗 Related Documentation

- [Overall Diagnostic](./LIMIT_ORDERS_DIAGNOSTIC_COMPLETE.md)
- [Expiry Fix Technical Details](./LIMIT_ORDERS_EXPIRY_FIX_COMPLETE.md)
- [Escrow Transparency](./LIMIT_ORDERS_ESCROW_TRANSPARENCY_COMPLETE.md)
- [Price Comparison](./LIMIT_ORDERS_PRICE_FIX_COMPLETE.md)
- [All Fixes Summary](./LIMIT_ORDERS_ALL_FIXES_COMPLETE.md)

---

**Date**: 2025-01-18  
**Status**: ✅ Complete - Ready for Testing  
**Developer**: GitHub Copilot
