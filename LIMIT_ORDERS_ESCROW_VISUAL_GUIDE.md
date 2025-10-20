# 🎨 Limit Orders - Escrow Transparency Visual Guide

## What Users See Now

### 📘 ACTIVE ORDER (Not Expired)

```
┌─────────────────────────────────────────────────────────┐
│  6nR8...pump    🟢 Buy                   Active         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  🔒  Funds Held in Jupiter Escrow                  │ │
│  │                                                     │ │
│  │  Your 0.5000 SOL are securely held in a Program    │ │
│  │  Derived Address (PDA) until the order executes    │ │
│  │  or you cancel it.                                 │ │
│  │                                                     │ │
│  │  [📋 View Escrow Program ↗] [📦 View Order Account ↗]│ │
│  │                                                     │ │
│  │  ℹ️ Important: If this order expires, your funds   │ │
│  │  will remain in escrow. You must manually cancel   │ │
│  │  the order to retrieve them.                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────┐    ↑    ┌──────────────┐            │
│  │CURRENT PRICE │         │TRIGGER PRICE │            │
│  │ $0.000031    │         │ $0.000031    │            │
│  └──────────────┘         └──────────────┘            │
│                                                          │
│              0% below target                            │
│                                                          │
│  💰 Amount: 0.000001 pump                              │
│  ⏱️ Created: 39h 1m ago                                │
│  ⏰ Expires In: 9d 23h                                 │
│  💵 Est. Value: 0.5000 SOL                             │
│                                                          │
│  📅 Created on Oct 17, 10:16 PM                        │
│  🔑 Order ID: GPe9gUdx...NXYATK                        │
│  📝 Create TX: 3kRRHN6V...xyz ↗                        │
│                                                          │
│  [        🗑️ Cancel Order        ]                     │
└─────────────────────────────────────────────────────────┘
```

**Colors**:
- Escrow badge: Light blue background (#EBF5FB)
- Border: Blue (#4299E1)
- Links: Cyan (#4FC3F7)
- Text: Dark gray (#2D3748)

---

### 🔴 EXPIRED ORDER (Funds Locked)

```
┌─────────────────────────────────────────────────────────┐
│  6nR8...pump    🟢 Buy                   Active         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ⚠️  ORDER EXPIRED - FUNDS LOCKED IN ESCROW  ⚠️    │ │
│  │                                                     │ │
│  │  This order expired on Oct 27, 10:16 PM.          │ │
│  │  Your 0.5000 SOL are currently held in Jupiter's  │ │
│  │  escrow program and will NOT be returned          │ │
│  │  automatically.                                    │ │
│  │                                                     │ │
│  │  ┌───────────────────────────────────────────────┐ │ │
│  │  │  🔒 Escrow Program:                           │ │ │
│  │  │  jupoNjAx...Nrnu ↗                            │ │ │
│  │  │                                                │ │ │
│  │  │  📦 Order Account:                            │ │ │
│  │  │  GPe9gUdx...NXYATK ↗                          │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  │                                                     │ │
│  │  ⚡ You must cancel this order below to retrieve   │ │
│  │  your funds from escrow!                           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────┐    ↑    ┌──────────────┐            │
│  │CURRENT PRICE │         │TRIGGER PRICE │            │
│  │ $0.000031    │         │ $0.000031    │            │
│  └──────────────┘         └──────────────┘            │
│                                                          │
│              0% below target                            │
│                                                          │
│  💰 Amount: 0.000001 pump                              │
│  ⏱️ Created: 10d 1h ago                                │
│  ⏰ Expires In: ⚠️ EXPIRED                             │
│  💵 Est. Value: 0.5000 SOL                             │
│                                                          │
│  📅 Created on Oct 17, 10:16 PM                        │
│  🔑 Order ID: GPe9gUdx...NXYATK                        │
│  📝 Create TX: 3kRRHN6V...xyz ↗                        │
│                                                          │
│  [   ⚡ CANCEL & RETRIEVE FUNDS   ]  ← PULSING         │
│  Click to return your funds from escrow                 │
└─────────────────────────────────────────────────────────┘
```

**Colors**:
- Warning banner: Red gradient (#FF6B6B to #EE5A6F)
- Border: Bright red (#FF4757)
- Pulsing glow animation (shadow 15px → 25px)
- Links: Cyan on dark background
- Cancel button: Red gradient, pulsing scale animation

---

**Last Updated**: January 2025  
**Visual Guide Version**: 1.0  
**Status**: Complete
