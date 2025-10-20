# 🚀 Fund Retrieval Quick Reference Card

## 🎯 What Was Added

**Enhanced expired order UX with dual fund retrieval options**

---

## 📍 Where to Find It

### History Tab (Expired Orders)
- **Location**: ProfileView → History Tab
- **Trigger**: Order with `isExpired: true` AND not cancelled/executed
- **Display**: Red gradient warning badge with dual action buttons

### Active Tab (Expired Orders)
- **Location**: ProfileView → Active Orders Tab
- **Trigger**: Active order with `isExpired: true`
- **Display**: Large pulsing cancel button + Jupiter link

---

## 🎨 Visual Elements

### History Tab Badge
```
╔══════════════════════════════╗
║ ⚠️ This order expired -      ║
║ Retrieve your funds now!     ║
║                               ║
║ Funds held in Jupiter escrow ║
║ Cancel to get them back      ║
║                               ║
║ [💰 Cancel] [Jupiter ↗]     ║
╚══════════════════════════════╝
```

### Active Tab Button
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚡ CANCEL & RETRIEVE FUNDS ┃
┃  (Pulsing red animation)   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Click to return funds from escrow
or manage on Jupiter ↗
```

---

## 🔧 User Actions

### Action 1: In-App Cancel (Recommended)
1. Click "💰 Cancel & Retrieve" button
2. Sign transaction with wallet
3. Funds returned automatically
4. Order marked as cancelled

### Action 2: External Jupiter (Fallback)
1. Click "Or use Jupiter ↗" link
2. Opens Jupiter limit order page
3. Cancel order there
4. Return to MoonFeed

---

## 💻 Code Locations

**File**: `frontend/src/components/ProfileView.jsx`

- **History Tab**: Lines ~1128-1217
- **Active Tab**: Lines ~1089-1147
- **Cancel Handler**: Lines 159-220

---

## 🎯 User Benefits

✅ **Clear Visual Warning** - Impossible to miss expired orders  
✅ **Education** - Understands escrow mechanics  
✅ **Dual Options** - In-app OR external retrieval  
✅ **Trust** - Multiple pathways reduce lock-in fear  
✅ **Mobile Friendly** - Responsive button layout  

---

## 🧪 Testing Checklist

- [ ] History expired order shows red badge
- [ ] Both buttons render correctly
- [ ] Cancel button triggers wallet signature
- [ ] Jupiter link opens with wallet address
- [ ] Buttons stack properly on mobile
- [ ] Active tab shows pulsing button
- [ ] Loading states work ("⏳ Cancelling...")

---

## 📊 Button Styles

### Primary Button (White with Red Text)
```css
background: white
color: #ff6b6b
font-weight: 700
hover: translateY(-2px) + shadow
```

### Secondary Button (Semi-transparent)
```css
background: rgba(255,255,255,0.15)
color: white
border: 1px rgba(255,255,255,0.4)
hover: increase opacity
```

---

## 🔗 Jupiter Link Format

```
https://jup.ag/limit/{userWalletAddress}
```

Pre-filled with user's wallet address for convenience.

---

## 💡 Key Features

1. **Educational Messaging**
   - "Funds held in Jupiter's escrow"
   - "Must cancel to get them back"

2. **Visual Urgency**
   - Red gradients
   - Pulsing animations
   - Large button sizes

3. **Multiple Pathways**
   - In-app cancellation
   - External Jupiter link
   - Reduces user friction

4. **Clear Loading States**
   - "⏳ Cancelling..."
   - Disabled button state
   - Prevents double-clicks

---

## 🎨 Color Palette

| Element | Color |
|---------|-------|
| Warning BG | Linear gradient #ff6b6b → #ff5252 |
| Warning Border | #ff5252 |
| Primary Button BG | white |
| Primary Button Text | #ff6b6b |
| Secondary Button BG | rgba(255,255,255,0.15) |
| Link Color | #4FC3F7 |

---

## 📱 Responsive Breakpoints

**Desktop** (> 768px):
- Buttons side-by-side
- Each 140-200px width

**Mobile** (< 768px):
- Buttons stacked vertically
- Full width

---

## 🔄 Order Status Flow

```
EXPIRED + ACTIVE
    ↓
[Cancel Button Clicked]
    ↓
[Wallet Signs]
    ↓
CANCELLED
    ↓
Appears in History with cancel TX
```

---

## ⚠️ Edge Cases Handled

✅ Wallet not connected → Alert  
✅ Transaction decode fails → Error message  
✅ User rejects signature → Returns to view  
✅ Network error → Suggests Jupiter fallback  
✅ Already cancelled → No warning shown  
✅ Already executed → No warning shown  

---

## 📚 Related Documentation

- `LIMIT_ORDERS_FUND_RETRIEVAL_ENHANCED.md` - Full implementation details
- `LIMIT_ORDERS_FUND_RETRIEVAL_VISUAL_GUIDE.md` - Visual user journey
- `LIMIT_ORDERS_MANUAL_RETRIEVAL_LINKS.md` - Original manual links doc
- `LIMIT_ORDERS_ALL_FIXES_COMPLETE.md` - Comprehensive fix summary

---

## 🏁 Status

✅ **COMPLETE & PRODUCTION READY**

Both in-app cancellation AND Jupiter fallback link implemented across active and history tabs with professional UI/UX.

---

## 🚨 Important Notes

1. **Escrow is Jupiter's**: Funds held by Jupiter's program, not MoonFeed
2. **Cancellation Required**: Only way to retrieve funds from expired orders
3. **No Auto-Cancel**: User must manually trigger cancellation
4. **Dual Pathways**: Always provide both in-app and Jupiter options

---

**Last Updated**: January 2024  
**Component**: ProfileView.jsx  
**Feature**: Enhanced Fund Retrieval UX
