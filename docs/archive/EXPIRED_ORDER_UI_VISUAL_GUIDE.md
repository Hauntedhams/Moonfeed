# 📱 EXPIRED ORDER UI - VISUAL GUIDE

## 🎨 WHAT THE USER SEES

---

## SCENARIO: $10 Limit Order Expired (1 Hour Ago)

### ❌ BEFORE (Current Issue)

#### Active Tab:
```
┌────────────────────────────────────────┐
│  📊 Limit Orders                       │
│  [Active] [History]                    │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ BONK                    🟢 Buy   │ │
│  │                        Active    │ │
│  │                                  │ │
│  │ Current: $0.000018               │ │
│  │ Trigger: $0.000015               │ │
│  │                                  │ │
│  │ Amount: 666,666 BONK             │ │
│  │ Created: 2h ago                  │ │
│  │ Expires: 1h ago ⚠️ CONFUSING!   │ │ ← USER CONFUSED HERE
│  │                                  │ │
│  │      [Cancel Order]              │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```
**Problem**: Order shows as "Active" but already expired. User thinks it might still execute.

---

### ✅ AFTER (Fixed)

#### Active Tab:
```
┌────────────────────────────────────────┐
│  📊 Limit Orders                       │
│  [Active] [History]                    │
├────────────────────────────────────────┤
│                                        │
│          📋                            │
│     No active orders                   │
│                                        │
│  Create limit orders from any coin     │
│              card                      │
│                                        │
└────────────────────────────────────────┘
```
**Solution**: Expired order automatically removed from active view.

---

#### History Tab:
```
┌────────────────────────────────────────────────┐
│  📊 Limit Orders                               │
│  [Active] [History]                            │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ ⚠️  ORDER EXPIRED - FUNDS LOCKED         │ │ ← PROMINENT WARNING
│  │                                          │ │
│  │ This order has expired and will not      │ │
│  │ execute. Your funds are currently        │ │
│  │ held in Jupiter's escrow.                │ │
│  │                                          │ │
│  │ ⚡ You must cancel this order to         │ │
│  │    retrieve your funds!                  │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ BONK                          🟢 Buy     │ │
│  │                            history       │ │
│  │                                          │ │
│  │ Current Price    →    Trigger Price     │ │
│  │   $0.000018      ↑      $0.000015       │ │
│  │                                          │ │
│  │  20% above target                        │ │
│  │                                          │ │
│  │ ┌─────────────┬─────────────┐            │ │
│  │ │ 💰 Amount   │ ⏱️ Created   │            │ │
│  │ │ 666,666     │ 2h ago      │            │ │
│  │ │ BONK        │             │            │ │
│  │ └─────────────┴─────────────┘            │ │
│  │                                          │ │
│  │ ┌─────────────┬─────────────┐            │ │
│  │ │ ⏰ Expires  │ 💵 Est.Value│            │ │
│  │ │ ⚠️ EXPIRED  │ 0.0100 SOL  │ ← RED TEXT │ │
│  │ └─────────────┴─────────────┘            │ │
│  │                                          │ │
│  │ 📅 Created on Jan 2, 03:45 PM            │ │
│  │ 🔑 Order ID: ab12cd34...ef56gh           │ │
│  │ 📝 Create TX: 3U3rJZa8...4Gvk ↗          │ │
│  │                                          │ │
│  │  ╔════════════════════════════════╗      │ │
│  │  ║  ⚡ CANCEL & RETRIEVE FUNDS   ║ ← PULSING  │
│  │  ╚════════════════════════════════╝      │ │
│  │                                          │ │
│  │  Click to return your funds from escrow  │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```
**Solution**: 
- Clear warning banner in red
- Explicit message about funds in escrow
- Prominent pulsing cancel button
- Instructions for fund retrieval

---

## 🎨 COLOR CODING

### Active Orders (Normal)
- **Background**: White
- **Border**: Light gray
- **Text**: Black
- **Cancel Button**: Gray/Blue
- **Expiry Text**: Black (or orange if < 1hr)

### Active Orders (Expiring Soon < 1hr)
- **Expiry Text**: **Red** + **Bold**
- **Expiry Icon**: ⚠️
- **Cancel Button**: Normal (user can still use order)

### History Orders (Expired)
- **Warning Banner**: **Red Gradient** with shadow
- **Warning Icon**: ⚠️ (large)
- **Warning Text**: White on red
- **Expiry Badge**: "⚠️ EXPIRED" in red + bold
- **Cancel Button**: **Red Gradient** + **Pulsing Animation**
- **Button Text**: "⚡ CANCEL & RETRIEVE FUNDS"
- **Instruction Text**: Red + bold

---

## 📱 MOBILE VIEW

### Active Tab (Empty after expiration)
```
┌──────────────────────────┐
│  📊 Limit Orders         │
│  [Active] [History]      │
├──────────────────────────┤
│                          │
│        📋                │
│   No active orders       │
│                          │
│  Create limit orders     │
│  from any coin card      │
│                          │
└──────────────────────────┘
```

### History Tab (Expired order)
```
┌──────────────────────────────┐
│  📊 Limit Orders             │
│  [Active] [History]          │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ ⚠️ ORDER EXPIRED         │ │
│ │      FUNDS LOCKED        │ │
│ │                          │ │
│ │ This order expired.      │ │
│ │ Funds in Jupiter escrow. │ │
│ │                          │ │
│ │ ⚡ Cancel to retrieve!   │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ BONK      🟢 Buy         │ │
│ │           history        │ │
│ │                          │ │
│ │ Current → Trigger        │ │
│ │ $0.018 ↑ $0.015          │ │
│ │                          │ │
│ │ 💰 666,666 BONK          │ │
│ │ ⏱️ 2h ago                │ │
│ │ ⏰ ⚠️ EXPIRED             │ │
│ │ 💵 0.0100 SOL            │ │
│ │                          │ │
│ │ ┌──────────────────────┐ │ │
│ │ │ ⚡ CANCEL & RETRIEVE │ │ │ ← FULL WIDTH
│ │ │      FUNDS           │ │ │    BUTTON
│ │ └──────────────────────┘ │ │
│ │                          │ │
│ │ Click to return funds    │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 🎬 ANIMATION BEHAVIOR

### Pulse Animation (Expired Cancel Button)
```
0.0s: [Button at 100% size, shadow at 40%]
      ╔════════════════════════════════╗
      ║  ⚡ CANCEL & RETRIEVE FUNDS   ║
      ╚════════════════════════════════╝
           ↓
1.0s: [Button at 102% size, shadow at 60%] ← SLIGHTLY LARGER
      ╔═════════════════════════════════╗
      ║  ⚡ CANCEL & RETRIEVE FUNDS    ║
      ╚═════════════════════════════════╝
           ↓
2.0s: [Button at 100% size, shadow at 40%] ← BACK TO NORMAL
      ╔════════════════════════════════╗
      ║  ⚡ CANCEL & RETRIEVE FUNDS   ║
      ╚════════════════════════════════╝
      
      [LOOP INFINITE]
```

**Effect**: Gentle pulsing that draws attention without being annoying

---

## 🔔 NOTIFICATION TIMELINE

### User Timeline for $10 Order (1hr expiration)

```
Time    Event                           UI State
────────────────────────────────────────────────────────────
00:00   Order created                   ✅ Shows in Active tab
        ↓                               "Expires in 1h"

00:30   30 minutes pass                 ✅ Still in Active tab
        ↓                               "Expires in 30m"

00:50   10 minutes to expiration        ⚠️ Warning color
        ↓                               "Expires in 10m" (RED)

01:00   Order expires                   🚨 MOVED TO HISTORY
        ↓                               Banner: "FUNDS LOCKED"
                                        Button: "CANCEL & RETRIEVE"

01:00+  User navigates to History       ✅ Sees red warning
        ↓                               ✅ Clicks cancel button
                                        ✅ Funds returned
```

---

## 💡 USER EDUCATION

### What Users Learn

#### From Active Tab (Empty)
> "My expired order is gone from active - that makes sense, it's not active anymore!"

#### From History Tab (Warning Banner)
> "Oh! My funds are still in Jupiter's escrow. I need to cancel to get them back."

#### From Cancel Button
> "This button will retrieve my funds. It's safe to click."

#### From Success Message
> "Great! My funds are back. I can view the transaction on Solscan."

---

## 🎯 ACCESSIBILITY

### Visual Indicators
- ✅ **Color**: Red for danger/urgency
- ✅ **Icons**: ⚠️ for warnings, ⚡ for action
- ✅ **Size**: Larger text for important info
- ✅ **Weight**: Bold for critical messages
- ✅ **Animation**: Movement for attention

### Text Clarity
- ✅ **Plain Language**: "FUNDS LOCKED" not "Escrow retention"
- ✅ **Action-Oriented**: "CANCEL & RETRIEVE FUNDS" not "Revoke order"
- ✅ **Explicit**: "You must cancel" not "Consider cancelling"

### Layout
- ✅ **Top Position**: Warning at top of card
- ✅ **Full Width**: Button spans full width
- ✅ **White Space**: Padding around critical elements
- ✅ **Hierarchy**: Most important → least important

---

## 📊 EXPECTED USER BEHAVIOR

### Scenario 1: User with Expired Order (Current Issue)
1. Opens app
2. Navigates to Profile
3. Sees "Active Orders (0)"
4. Clicks "History" tab
5. **IMMEDIATELY SEES** red warning banner
6. Reads: "ORDER EXPIRED - FUNDS LOCKED"
7. Reads: "You must cancel to retrieve funds"
8. **CLICKS** pulsing red button
9. Approves transaction in wallet
10. ✅ **FUNDS RETURNED**

**Time to Resolution**: ~30 seconds  
**User Confidence**: High (clear instructions)  
**Support Tickets**: Eliminated

---

### Scenario 2: User Checking Active Orders
1. Opens app
2. Navigates to Profile → Active Orders
3. Sees only truly active orders
4. ✅ **NO CONFUSION** about order state
5. ✅ **ACCURATE VIEW** of what's executing

**User Experience**: Clean, trustworthy

---

### Scenario 3: Order About to Expire (50 minutes old)
1. User checks Active Orders
2. Sees order with "10m" in red
3. Decides to:
   - Option A: Let it expire → moves to history with warning
   - Option B: Cancel now → cancels with normal flow
4. ✅ **INFORMED DECISION**

**User Control**: Full control with clear information

---

## 🎉 SUCCESS METRICS

### Before Implementation
- ❌ Confusion: "Why is my order still active?"
- ❌ Support: "Where are my funds?"
- ❌ Trust: "Did I lose my money?"

### After Implementation
- ✅ Clarity: "My order expired, I see it in history"
- ✅ Self-Service: "I can cancel to get funds back"
- ✅ Confidence: "The system is working correctly"

---

**This UI transformation eliminates user confusion and ensures fund safety! 🚀**
