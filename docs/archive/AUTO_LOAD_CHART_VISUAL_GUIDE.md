# 📊 DexScreener Chart Auto-Load - Visual Guide

## 🎬 How It Works

### User Journey: BEFORE This Feature

```
┌─────────────────────────────────────────┐
│ USER SWIPES TO COIN #5                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Basic View (Page 0)                     │
│ ┌─────────────────────────────────────┐ │
│ │  Banner, Name, Price                │ │
│ │  PriceHistoryChart (1sec data)      │ │
│ │  • • (navigation dots)              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓ (enrichment starts)
              ↓ (1-2 seconds)
              ↓
┌─────────────────────────────────────────┐
│ ✅ Enrichment Complete                  │
│ • Banner loaded                         │
│ • Rugcheck loaded                       │
│ • Socials loaded                        │
│ 📊 Chart: NOT loaded (waiting) ❌       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ USER SWIPES RIGHT TO ADVANCED VIEW      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Advanced View (Page 1)                  │
│ ┌─────────────────────────────────────┐ │
│ │  📊                                 │ │
│ │  Interactive Chart Available        │ │
│ │                                     │ │
│ │  [📈 Load Chart Here]  ← BUTTON!   │ │
│ │  [🌐 Open in New Tab]              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ USER TAPS "LOAD CHART HERE" BUTTON      │
└─────────────────────────────────────────┘
              ↓ (chart loading starts)
              ↓ (3-5 seconds)
              ↓
┌─────────────────────────────────────────┐
│ Advanced View (Page 1)                  │
│ ┌─────────────────────────────────────┐ │
│ │  [DexScreener Chart Iframe]         │ │
│ │  📈📊 Chart visible!                │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

⏱️ TOTAL TIME: 5-7 seconds from swipe to chart
❌ FRICTION: User must tap button
```

---

### User Journey: AFTER This Feature ✨

```
┌─────────────────────────────────────────┐
│ USER SWIPES TO COIN #5                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Basic View (Page 0)                     │
│ ┌─────────────────────────────────────┐ │
│ │  Banner, Name, Price                │ │
│ │  PriceHistoryChart (1sec data)      │ │
│ │  • • (navigation dots)              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓ (enrichment starts)
              ↓ (1-2 seconds)
              ↓
┌─────────────────────────────────────────┐
│ ✅ Enrichment Complete                  │
│ • Banner loaded                         │
│ • Rugcheck loaded                       │
│ • Socials loaded                        │
│ 📊 Chart: AUTO-LOADING! 🆕              │
└─────────────────────────────────────────┘
              ↓ (chart loads in background)
              ↓ (3-5 seconds, parallel)
              ↓ (user can swipe anytime)
              ↓
┌─────────────────────────────────────────┐
│ USER SWIPES RIGHT TO ADVANCED VIEW      │
└─────────────────────────────────────────┘
              ↓ (instant!)
              ↓
┌─────────────────────────────────────────┐
│ Advanced View (Page 1)                  │
│ ┌─────────────────────────────────────┐ │
│ │  [DexScreener Chart Iframe]         │ │
│ │  📈📊 Chart ALREADY LOADED!         │ │
│ │  ✅ Ready instantly!                │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

⏱️ TOTAL TIME: 0 seconds (chart preloaded!)
✅ ZERO FRICTION: No button tap needed
```

---

## 🔄 State Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    COIN COMPONENT STATE                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Initial State:                                               │
│  • isEnriched = false                                         │
│  • enrichmentRequested = false                                │
│  • enrichmentCompleted = false  ← NEW STATE!                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ TRIGGER: Coin becomes visible (isVisible = true)             │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ ACTION: Start enrichment API call                            │
│ • enrichmentRequested = true                                  │
└──────────────────────────────────────────────────────────────┘
                        ↓ (500ms debounce)
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ API CALL: POST /enrich-single                                │
│ • Fetches banner, rugcheck, socials                          │
└──────────────────────────────────────────────────────────────┘
                        ↓ (1-2 seconds)
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ RESPONSE: Enrichment data received                           │
│ • isEnriched = true                                           │
│ • enrichmentCompleted = true  🆕 NEW!                        │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ EFFECT: enrichmentCompleted changes from false → true        │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ PROP UPDATE: autoLoad={enrichmentCompleted}                  │
│ • Passed to DexScreenerChart component                       │
│ • autoLoad changes from false → true                         │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│         DEXSCREENER CHART COMPONENT                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Initial State (Mobile):                                       │
│ • showIframe = false (chart hidden)                          │
│                                                               │
│ After autoLoad prop changes:                                  │
│ • autoLoad = true detected!                                   │
│ • showIframe = true  🆕 (chart starts loading)               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ IFRAME LOADS: DexScreener embed in background                │
│ • User doesn't see it yet (currentChartPage = 0)            │
│ • But iframe is loading in the DOM                           │
└──────────────────────────────────────────────────────────────┘
                        ↓ (3-5 seconds)
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ IFRAME LOADED: Chart ready to display                        │
│ • isLoading = false                                           │
│ • Chart fully rendered (hidden until user swipes)           │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ USER ACTION: Swipes right to advanced view                    │
│ • currentChartPage changes from 0 → 1                        │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ RENDER: Advanced view shown                                   │
│ • currentChartPage === 1 (condition met)                     │
│ • DexScreenerChart component is visible                      │
│ • Chart is ALREADY LOADED! ✅ Instant display                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Memory Management

### How Virtual Scrolling Protects Memory

```
SCENARIO: User scrolls through 100 coins

┌────────────────────────────────────────────────────────┐
│ WITHOUT VIRTUAL SCROLLING (Old, would crash)           │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Coin #1:  CoinCard + DexScreener iframe ✅             │
│ Coin #2:  CoinCard + DexScreener iframe ✅             │
│ Coin #3:  CoinCard + DexScreener iframe ✅             │
│ ...                                                     │
│ Coin #100: CoinCard + DexScreener iframe ✅            │
│                                                         │
│ Total: 100 iframes × 2-5 MB = 200-500 MB ❌ CRASH!    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ WITH VIRTUAL SCROLLING (Current, safe)                 │
├────────────────────────────────────────────────────────┤
│                                                         │
│ User at coin #50:                                       │
│                                                         │
│ Coin #1-47:  Empty placeholder (1KB each) ⬜           │
│ Coin #48:    CoinCard + DexScreener iframe ✅          │
│ Coin #49:    CoinCard + DexScreener iframe ✅          │
│ Coin #50:    CoinCard + DexScreener iframe ✅ Current  │
│ Coin #51:    CoinCard + DexScreener iframe ✅          │
│ Coin #52:    CoinCard + DexScreener iframe ✅          │
│ Coin #53-100: Empty placeholder (1KB each) ⬜          │
│                                                         │
│ Total: 5 iframes × 5 MB = 25 MB ✅ SAFE!               │
└────────────────────────────────────────────────────────┘

KEY INSIGHT:
✅ Virtual scrolling limits active iframes to 5-7 max
✅ Auto-load only affects VISIBLE coins (5-7)
✅ Memory stays under 50MB even with auto-load
✅ No risk of crashes from too many iframes
```

---

## 🎯 Loading States Visual

### Desktop (Always Auto-Loads)

```
┌─────────────────────────────────┐
│ DESKTOP: Advanced View          │
├─────────────────────────────────┤
│                                  │
│ [DexScreener Chart]             │
│ ┌─────────────────────────────┐ │
│ │ 📊 Chart loads immediately  │ │
│ │ (autoLoad = true by default)│ │
│ └─────────────────────────────┘ │
│                                  │
└─────────────────────────────────┘
```

### Mobile BEFORE Enrichment

```
┌─────────────────────────────────┐
│ MOBILE: Advanced View           │
├─────────────────────────────────┤
│                                  │
│ [Placeholder with Button]       │
│ ┌─────────────────────────────┐ │
│ │       📊                    │ │
│ │ Interactive Chart Available │ │
│ │                             │ │
│ │ [📈 Load Chart Here] ← TAP │ │
│ │ [🌐 Open in New Tab]       │ │
│ └─────────────────────────────┘ │
│                                  │
│ enrichmentCompleted = false     │
│ autoLoad = false                │
└─────────────────────────────────┘
```

### Mobile AFTER Enrichment (NEW!)

```
┌─────────────────────────────────┐
│ MOBILE: Advanced View           │
├─────────────────────────────────┤
│                                  │
│ [DexScreener Chart]             │
│ ┌─────────────────────────────┐ │
│ │ 📊 Chart auto-loaded! 🆕    │ │
│ │ (ready when user swipes)    │ │
│ └─────────────────────────────┘ │
│                                  │
│ enrichmentCompleted = true      │
│ autoLoad = true ✅               │
└─────────────────────────────────┘
```

---

## 🔄 Timing Diagram

```
Time:  0s    1s    2s    3s    4s    5s    6s    7s
       │     │     │     │     │     │     │     │
       │
       ├─ User swipes to coin
       │
       ├──────────┤
       │  Enrichment (1-2s)
       │          │
       │          ├─ enrichmentCompleted = true ✅
       │          │
       │          ├────────────────────────┤
       │          │  Chart loading (3-5s)  │
       │          │                        │
       │          │  (happens in parallel  │
       │          │   while user views     │
       │          │   basic info)          │
       │          │                        │
       ├──────────┼────────────────────────┤
       │ User can swipe to advanced view    │
       │ ANYTIME after enrichment           │
       │                                     │
       │ If user swipes at 3s:               │
       │ → Chart still loading (shows loading indicator)
       │                                     │
       │ If user swipes at 7s:               │
       │ → Chart already loaded! ✅ Instant display
       │                                     │
```

---

**Visual Summary**:
- 🔵 **Before**: Manual button tap required → 5-7 second wait
- 🟢 **After**: Auto-loads after enrichment → Instant when user swipes
- 🛡️ **Safe**: Virtual scrolling prevents memory issues
- 🚀 **Fast**: Charts preload in background while user reads

