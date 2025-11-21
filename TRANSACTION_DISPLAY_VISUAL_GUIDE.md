# Transaction Display Visual Guide

## New 3-Row Transaction Layout

### Before (Helius - Single Row)
```
┌────────────────────────────────────────────────────────┐
│ 👛 1234..5678  │  SWAP  │  2:30:45 PM ↗               │
└────────────────────────────────────────────────────────┘
```

### After (Solana RPC - Three Rows)
```
┌────────────────────────────────────────────────────────┐
│ Row 1: 👛 1234..5678  │  SWAP  │  2:30:45 PM ↗        │
│                                                          │
│ Row 2: 📊 Raydium     💰 1,234.56     [Failed]        │
│                                                          │
│ Row 3: Other wallets: 9abc..def0  5xyz..1234 +2 more  │
└────────────────────────────────────────────────────────┘
```

## Detailed Breakdown

### Row 1: Primary Transaction Info
- **Wallet Icon + Address:** 👛 1234..5678 (clickable, shows fee payer)
- **Type Badge:** Color-coded pill (green for SWAP, blue for TRANSFER)
- **Timestamp + Link:** Time with Solscan link (↗ icon)

### Row 2: Enhanced Details
- **DEX/Program:** 📊 Shows which DEX was used
  - Raydium, Jupiter, Orca, Meteora, Pump.fun, etc.
- **Amount:** 💰 Token amount transferred/swapped
  - Automatically extracted from balance changes
  - Formatted with commas and 2 decimal places
- **Error Badge:** [Failed] if transaction errored (red badge)

### Row 3: Additional Wallets
- **Label:** "Other wallets:"
- **Wallet List:** Up to 3 additional wallet addresses
  - All clickable for wallet details
  - Truncated format: 9abc..def0
- **Overflow Counter:** "+2 more" if more than 4 wallets

## Color Scheme

### Transaction Types
- **SWAP:** 🟢 Green background (#4CAF50)
- **TRANSFER:** 🔵 Blue background (#2196F3)
- **UNKNOWN:** Default neutral

### Element Colors
- **Wallet Addresses:** #4FC3F7 (Light Blue) - Clickable
- **DEX Names:** #FFB74D (Orange)
- **Amounts:** #66BB6A (Light Green)
- **Error Badge:** #F44336 (Red)
- **Timestamp:** #999 (Gray)
- **Additional Wallets:** #666 (Dark Gray)

## Interactive Elements

### Clickable Wallet Addresses
All wallet addresses are clickable and trigger wallet detail view:
- Primary wallet (Row 1)
- Additional wallets (Row 3)
- Hover shows full address as tooltip

### External Link
Timestamp links to Solscan transaction explorer:
- Opens in new tab
- Shows ↗ icon indicator

## Examples

### Example 1: Successful Swap on Raydium
```
┌────────────────────────────────────────────────────────┐
│ 👛 GvC8...x9Hs  │ [SWAP] │  3:42:15 PM ↗              │
│ 📊 Raydium      💰 500.25                              │
│ Other wallets: 2jKs..8Lp9  7Qwt..3Mnk                 │
└────────────────────────────────────────────────────────┘
```

### Example 2: Failed Transfer
```
┌────────────────────────────────────────────────────────┐
│ 👛 4nZx...2Bw7  │ [TRANSFER] │  1:23:08 PM ↗          │
│ 📊 Token Program   💰 1,000.00   [Failed]             │
└────────────────────────────────────────────────────────┘
```

### Example 3: Jupiter Aggregator Swap (Many Wallets)
```
┌────────────────────────────────────────────────────────┐
│ 👛 8Prt...5Kjn  │ [SWAP] │  4:15:32 PM ↗              │
│ 📊 Jupiter      💰 2,345.67                            │
│ Other wallets: 9Lmn..4Tyu  3Vbx..8Qwe  6Hjk..2Asd +3  │
└────────────────────────────────────────────────────────┘
```

## Responsive Behavior

### Desktop
- Full 3-row layout with all details
- Wider spacing and larger fonts
- All interactive elements fully functional

### Mobile
- WebSocket disabled (no live transactions)
- Static "Load Live Transactions" button shown
- Layout adapts to smaller screen width

## Animation

### New Transaction Entrance
- Slides in from top with 0.3s ease-out animation
- Only applies to first (newest) transaction
- Other transactions remain static

## Accessibility

- All clickable elements have proper cursor indicators
- Tooltips show full wallet addresses on hover
- Color contrast meets WCAG standards
- External links have proper rel="noopener noreferrer"

---

**Key Improvement:** Users can now see **who** traded, **where** (which DEX), and **how much**, not just transaction type and time!
