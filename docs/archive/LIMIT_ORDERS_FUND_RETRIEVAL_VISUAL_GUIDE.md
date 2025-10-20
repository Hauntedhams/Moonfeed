# 🎨 Enhanced Fund Retrieval: Visual User Journey

## 📱 User Interface Walkthrough

### 🔴 SCENARIO 1: Expired Order in History Tab

```
┌─────────────────────────────────────────────────────────┐
│  ProfileView - History Tab                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ╔══════════════════════════════════════════════════╗  │
│  ║  🚨 EXPIRED ORDER WARNING (Red Gradient)         ║  │
│  ║  ┌──────────────────────────────────────────┐   ║  │
│  ║  │  ⚠️  This order expired -                │   ║  │
│  ║  │      Retrieve your funds now!            │   ║  │
│  ║  └──────────────────────────────────────────┘   ║  │
│  ║                                                  ║  │
│  ║  Your funds are held in Jupiter's escrow.       ║  │
│  ║  You must cancel this order to get them back.   ║  │
│  ║                                                  ║  │
│  ║  ┌──────────────────┐  ┌──────────────────┐    ║  │
│  ║  │ 💰 Cancel &      │  │ Or use Jupiter ↗│    ║  │
│  ║  │    Retrieve      │  │                  │    ║  │
│  ║  └──────────────────┘  └──────────────────┘    ║  │
│  ║   (White, Bold)         (Semi-transparent)      ║  │
│  ╚══════════════════════════════════════════════════╝  │
│                                                          │
│  Order Details:                                          │
│  • Trigger Price: $0.0025                               │
│  • Amount: 1000 MEME                                    │
│  • Created: Jan 15, 2024                                │
│                                                          │
│  Transaction Signatures:                                 │
│  Create: 5Kf8m... ↗                                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 🔴 SCENARIO 2: Expired Order in Active Tab

```
┌─────────────────────────────────────────────────────────┐
│  ProfileView - Active Orders Tab                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Order #5Kf8m...                                        │
│  Token: MEME • Trigger: $0.0025                        │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ⚠️ EXPIRED                                      │   │
│  │  This order expired but is still active          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃                                                  ┃   │
│  ┃   ⚡ CANCEL & RETRIEVE FUNDS                    ┃   │
│  ┃   (Large, Red, Pulsing Animation)               ┃   │
│  ┃                                                  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                          │
│  Click to return your funds from escrow                 │
│                                                          │
│  or manage on Jupiter ↗                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🎬 User Interaction Flow

### Flow 1: In-App Cancellation (Recommended)

```
1. USER SEES EXPIRED WARNING
   ┌─────────────────────────┐
   │  ⚠️ Order Expired        │
   │  Retrieve funds now!     │
   │                          │
   │  [💰 Cancel & Retrieve] │
   └─────────────────────────┘
              ↓
              
2. USER CLICKS "CANCEL & RETRIEVE"
   ┌─────────────────────────┐
   │  ⏳ Cancelling...        │
   │  (Button disabled)       │
   └─────────────────────────┘
              ↓
              
3. WALLET SIGNATURE PROMPT
   ┌─────────────────────────┐
   │  Phantom Wallet          │
   │                          │
   │  Approve transaction to  │
   │  cancel limit order?     │
   │                          │
   │  [Approve] [Reject]      │
   └─────────────────────────┘
              ↓
              
4. TRANSACTION PROCESSING
   ┌─────────────────────────┐
   │  Processing transaction  │
   │  on Solana...            │
   │  [Progress indicator]    │
   └─────────────────────────┘
              ↓
              
5. SUCCESS - ORDER REMOVED
   ┌─────────────────────────┐
   │  ✓ Order cancelled!      │
   │  Funds returned to       │
   │  your wallet             │
   └─────────────────────────┘
              ↓
              
6. ORDER MOVES TO HISTORY (CANCELLED)
   ┌─────────────────────────┐
   │  Status: Cancelled       │
   │  ✓ Cancelled: View TX ↗  │
   └─────────────────────────┘
```

---

### Flow 2: Jupiter External Link (Fallback)

```
1. USER SEES EXPIRED WARNING
   ┌─────────────────────────┐
   │  ⚠️ Order Expired        │
   │  Retrieve funds now!     │
   │                          │
   │  [Or use Jupiter ↗]     │
   └─────────────────────────┘
              ↓
              
2. USER CLICKS "OR USE JUPITER"
   New tab opens:
   https://jup.ag/limit/UserWalletAddress123...
              ↓
              
3. JUPITER LIMIT ORDER PAGE
   ┌─────────────────────────────────┐
   │  Jupiter - Limit Orders          │
   │                                  │
   │  Your Active Orders:             │
   │  ┌────────────────────────────┐ │
   │  │ MEME → SOL                 │ │
   │  │ Trigger: $0.0025           │ │
   │  │ [Cancel Order]             │ │
   │  └────────────────────────────┘ │
   └─────────────────────────────────┘
              ↓
              
4. USER CANCELS ON JUPITER
   • Wallet signature prompt
   • Transaction processed
   • Funds returned
              ↓
              
5. USER RETURNS TO MOONFEED
   • Refreshes order list
   • Order no longer in active
   • Appears in history as cancelled
```

---

## 🎨 Visual Design Details

### Color Palette

```
EXPIRED WARNING:
┌────────────────────────────────┐
│ Background: Linear Gradient     │
│ #ff6b6b (Red) → #ff5252 (Dark) │
│                                 │
│ Border: 2px solid #ff5252       │
│ Shadow: 0 4px 12px rgba(255...) │
└────────────────────────────────┘

PRIMARY BUTTON (Cancel & Retrieve):
┌────────────────────────────────┐
│ Background: white               │
│ Text: #ff6b6b (Red)            │
│ Font: 700 (Bold), 13px         │
│ Shadow: 0 2px 8px rgba(0...)   │
│ Hover: Transform up 2px        │
└────────────────────────────────┘

SECONDARY BUTTON (Jupiter Link):
┌────────────────────────────────┐
│ Background: rgba(255,255,255,.15)│
│ Text: white                     │
│ Border: 1px rgba(255,255,255,.4)│
│ Font: 600 (Semi-bold), 13px    │
└────────────────────────────────┘
```

---

### Typography Hierarchy

```
WARNING TITLE:
  "⚠️ This order expired - Retrieve your funds now!"
  • Size: 13px
  • Weight: 600 (Semi-bold)
  • Icon: 16px

EDUCATIONAL TEXT:
  "Your funds are held in Jupiter's escrow..."
  • Size: 11px
  • Weight: Normal
  • Opacity: 0.9
  • Line height: 1.4

BUTTON TEXT:
  "💰 Cancel & Retrieve"
  • Size: 13px
  • Weight: 700 (Bold)
  
SUB-TEXT:
  "Click to return your funds from escrow"
  • Size: 13px (active) / 12px (history)
  • Weight: 600
  • Color: #ff4757 (active) / rgba(0,0,0,0.6) (history)
```

---

## 📐 Responsive Behavior

### Desktop (> 768px)

```
┌────────────────────────────────────────┐
│  [💰 Cancel & Retrieve] [Jupiter ↗]  │
│     (Side by side, flex)                │
└────────────────────────────────────────┘
• Buttons: 140-200px each
• Gap: 8px
• Justify: center
```

### Mobile (< 768px)

```
┌────────────────────┐
│ [💰 Cancel &      │
│    Retrieve]       │
└────────────────────┘
        ↓
┌────────────────────┐
│ [Jupiter ↗]       │
└────────────────────┘
• Buttons: Stack vertically
• Full width: 100%
• Gap: 8px
```

---

## 🎭 Animation & Interaction States

### Active Tab Cancel Button (Expired)

```css
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
    transform: scale(1.02);
  }
}

Duration: 2s
Iteration: infinite
```

### Button Hover States

**Primary (Cancel & Retrieve)**:
```
Default:  transform: translateY(0)
Hover:    transform: translateY(-2px)
          box-shadow: 0 4px 12px rgba(0,0,0,0.2)
```

**Secondary (Jupiter Link)**:
```
Default:  background: rgba(255,255,255,0.15)
Hover:    background: rgba(255,255,255,0.25)
          border: rgba(255,255,255,0.6)
```

---

## 🧩 Component Structure

```
ProfileView.jsx
│
├─ Active Orders Section
│  ├─ Order Card
│  │  ├─ Order Header
│  │  ├─ Price & Details
│  │  ├─ Expiry Info
│  │  └─ Action Section
│  │     ├─ Cancel Button (pulsing if expired)
│  │     └─ Helper Text + Jupiter Link
│  │
│
└─ History Section
   ├─ Order Card
   │  ├─ Expired Warning Badge (if expired & uncancelled)
   │  │  ├─ Warning Icon + Text
   │  │  ├─ Educational Subtext
   │  │  └─ Dual Action Buttons
   │  │     ├─ Primary: Cancel & Retrieve
   │  │     └─ Secondary: Jupiter Link
   │  │
   │  ├─ Order Details
   │  └─ Transaction Signatures
```

---

## 🔄 State Management

### Order States

```javascript
// Expired, Not Cancelled
{
  status: 'active' | 'expired',
  isExpired: true,
  cancelTxSignature: null,
  executeTxSignature: null
}
→ Shows: FULL EXPIRED WARNING + DUAL BUTTONS

// Cancelled
{
  status: 'cancelled',
  isExpired: true,
  cancelTxSignature: '5Kf8m...'
}
→ Shows: Cancelled badge + TX link (no warning)

// Executed
{
  status: 'executed',
  executeTxSignature: 'Abc123...'
}
→ Shows: Executed badge + TX link (no warning)
```

---

## 💬 User Feedback Messages

### Success Messages
```
✅ "Order cancelled successfully!"
✅ "Funds returned to your wallet"
✅ "Transaction confirmed"
```

### Error Messages
```
❌ "Failed to cancel order. Please try again."
❌ "Wallet connection required"
❌ "Transaction rejected by user"
❌ "Network error - try using Jupiter link"
```

### Loading States
```
⏳ "Cancelling..."
⏳ "Processing transaction..."
⏳ "Refreshing orders..."
```

---

## 🎯 Accessibility Features

1. **High Contrast**:
   - Red warning (#ff6b6b) on white background
   - Meets WCAG AA standards

2. **Clear Call-to-Action**:
   - Action buttons clearly labeled
   - Icons + text for clarity

3. **Multiple Pathways**:
   - In-app cancel (primary)
   - External link (fallback)
   - Reduces user frustration

4. **Responsive Design**:
   - Mobile-friendly button sizes
   - Touch-friendly tap targets (min 44px)

5. **Loading Indicators**:
   - Clear disabled state
   - Loading text feedback

---

## 📊 A/B Comparison

### BEFORE Enhancement
```
┌─────────────────────────────┐
│  ⚠️ This order expired -     │
│  funds may still be in      │
│  escrow if not cancelled    │
└─────────────────────────────┘
• Small text warning
• No action buttons
• Unclear what to do
• Manual Jupiter navigation
```

### AFTER Enhancement
```
╔═════════════════════════════╗
║  ⚠️ This order expired -     ║
║  Retrieve your funds now!   ║
║                              ║
║  Your funds are held in     ║
║  Jupiter's escrow. You must ║
║  cancel to get them back.   ║
║                              ║
║  [💰 Cancel] [Jupiter ↗]   ║
╚═════════════════════════════╝
• Prominent red badge
• Educational text
• TWO clear actions
• Direct in-app cancel
```

---

## 🏁 User Journey Summary

```
USER OPENS APP
    ↓
SEES EXPIRED ORDER
    ↓
READS WARNING BADGE
    ↓
UNDERSTANDS:
  • Funds in Jupiter escrow
  • Must cancel to retrieve
    ↓
CHOOSES ACTION:
    ↓                    ↓
IN-APP CANCEL      JUPITER LINK
    ↓                    ↓
WALLET SIGNS       EXTERNAL CANCEL
    ↓                    ↓
FUNDS RETURNED     FUNDS RETURNED
    ↓                    ↓
ORDER CANCELLED IN HISTORY
    ↓
✅ COMPLETE
```

---

## 📝 Key Takeaways

1. **Visual Urgency**: Red gradients + animations grab attention
2. **Education**: Clear explanation of escrow mechanics
3. **Actionability**: Two clear pathways to retrieve funds
4. **Trust**: Providing alternatives builds user confidence
5. **Consistency**: Same UX across active and history tabs

**Result**: Users can quickly identify, understand, and resolve expired orders with clear, actionable UI elements.
