# Profile & Limit Orders - Visual Guide

## 🎨 New Design Elements

### Price Comparison Section
```
┌─────────────────────────────────────────────────────────┐
│  Order Price Progress                                   │
│  ┌────────────────┐   ┌────┐   ┌────────────────┐      │
│  │ CURRENT PRICE  │   │ ↓  │   │ TRIGGER PRICE  │      │
│  │   $0.000123    │   │    │   │   $0.000100    │      │
│  └────────────────┘   └────┘   └────────────────┘      │
│                                                          │
│          🟢 23% above target                            │
└─────────────────────────────────────────────────────────┘
```

### Order Details Grid
```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 💰 Amount    │  │ ⏱️ Created   │  │ ⏰ Expires   │  │
│  │ 1,000 BONK   │  │ 2h 15m ago   │  │ 22h 45m      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 💵 Est. Value                                    │   │
│  │ $0.123                                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 📊 Data Flow

### Backend Enrichment Process
```
Jupiter API Order
       ↓
Extract inputMint/outputMint
       ↓
Determine Buy/Sell (check if SOL)
       ↓
Fetch Token Metadata (Jupiter Tokens API)
   ┌──────────────────┐
   │ Symbol: BONK     │
   │ Decimals: 5      │
   │ Name: Bonk       │
   └──────────────────┘
       ↓
Calculate with Correct Decimals
   makingAmount / 10^decimals
   takingAmount / 10^decimals
       ↓
Calculate Trigger Price
   Buy: SOL/token = making/taking
   Sell: SOL/token = taking/making
       ↓
Return Enriched Order
```

### Frontend Price Enhancement
```
Enriched Order from Backend
       ↓
Fetch Current Price (DexScreener)
   ┌──────────────────────────────┐
   │ GET /tokens/{tokenMint}      │
   │ → pairs[0].priceNative       │
   └──────────────────────────────┘
       ↓
Calculate % Difference
   (current - trigger) / trigger * 100
       ↓
Display in UI
```

## 🎯 Before vs After

### Before:
```
Order Card
├── Token: Unknown
├── Type: buy
├── Price: $0
├── Amount: 0
└── [Cancel Button]
```

### After:
```
Order Card
├── Header
│   ├── Token: BONK 🟢 Buy
│   └── Status: active
├── Price Progress
│   ├── Current: $0.000123 ↓ Trigger: $0.000100
│   └── Badge: 23% above target
├── Details Grid
│   ├── Amount: 1,000 BONK
│   ├── Created: 2h 15m ago
│   ├── Expires: 22h 45m
│   └── Est. Value: $0.123
├── Additional Info
│   ├── Created on Jan 15, 2025
│   └── Order ID: 7xB4k2...9mF3pQ
└── [Cancel Order Button]
```

## 🎨 Color Scheme

### Price Boxes:
- **Current Price**: Purple gradient (#818cf8 border, #f5f7ff background)
- **Trigger Price**: Green gradient (#34d399 border, #f0fdf8 background)
- **Arrow**: Purple circle (#667eea, white background)

### Status Badges:
- **Active**: Blue (#dbeafe background, #1e40af text)
- **Executed**: Green (#d1fae5 background, #065f46 text)
- **Cancelled**: Gray (#f3f4f6 background, #6b7280 text)

### Order Types:
- **Buy**: Green (#d1fae5 background, #065f46 text)
- **Sell**: Red (#fee2e2 background, #991b1b text)

### Price Difference:
- **Close to Target**: Green gradient (#d1fae5 to #a7f3d0)
- **Away from Target**: Yellow gradient (#fef3c7 to #fde68a)

## 📱 Responsive Layouts

### Desktop (>640px):
```
Current Price  →  Trigger Price
    (side by side with arrow)
```

### Mobile (<640px):
```
Current Price
      ↓
   (arrow)
      ↓
Trigger Price
  (stacked)
```

## ✨ Animations

1. **Card Hover**: Lift + shadow increase
2. **Button Hover**: Color shift + lift
3. **Price Box Hover**: Lift + shadow increase
4. **Loading**: Spinner rotation
5. **Transitions**: 0.2s ease on all interactive elements

## 🔑 Key Features

### Automatic Data Enrichment:
✅ Token symbols from Jupiter
✅ Correct decimal handling
✅ Real-time price updates
✅ Accurate calculations

### User-Friendly Display:
✅ Clear price comparison
✅ Percentage differences
✅ Time formatting (e.g., "2h 15m ago")
✅ Shortened addresses/IDs

### Error Handling:
✅ Fallback to defaults
✅ Retry buttons
✅ Loading states
✅ Empty states with helpful messages

## 🚀 Performance

- **Parallel API calls** for token metadata
- **Cached token data** (implicit in Jupiter's API)
- **Minimal re-renders** with proper state management
- **Optimistic UI** updates

## 💡 User Tips

1. **Understanding the Arrow**:
   - For Buy orders: ↑ means price needs to go up, ↓ means it needs to go down
   - For Sell orders: ↑ means price is above trigger (good), ↓ means below

2. **Percentage Badge**:
   - Green = Close to triggering
   - Yellow = Far from triggering
   - Shows how much price needs to move

3. **Time Displays**:
   - "Created" = Time since order was placed
   - "Expires In" = Time until order auto-cancels
   - Both in human-readable format (e.g., "2h 15m")

## 🎉 Result

A professional, data-rich limit orders interface that provides traders with all the information they need at a glance!
