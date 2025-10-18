# 🎓 Graduation Percentage - Quick Visual Reference

## What You'll See

When viewing coins in the **Graduating** feed, each coin will now display a graduation progress indicator below the price:

```
┌─────────────────────────────────────┐
│  Profile  [Price Section]           │
│  Image    ━━━━━━━━━━━━              │
│           $0.0001234                 │
│           +12.5% ↗                   │
│                                      │
│           ╔════════════════╗         │
│           ║ 🎓 92.45% 🚀  ║         │
│           ║ Almost There! ║         │
│           ║ Updates 2 min ║         │
│           ╚════════════════╝         │
└─────────────────────────────────────┘
```

---

## Color Guide

### 🟢 Green (95%+)
```
┌──────────────────────┐
│  🎓 97.80% 🚀       │  ← PULSING ANIMATION
│  Almost There! 🎯    │
│  Updates every 2 min │
└──────────────────────┘
Color: Bright Green (#10b981)
Border: Solid green
Status: Ready to graduate!
```

### 🟡 Yellow (75-95%)
```
┌──────────────────────┐
│  🎓 82.15%          │  ← Static
│  Progressing 💪      │
│  Updates every 2 min │
└──────────────────────┘
Color: Yellow (#eab308)
Border: Solid yellow
Status: Building momentum
```

### 🟠 Orange (50-75%)
```
┌──────────────────────┐
│  🎓 63.40%          │  ← Static
│  Building Up 🏗️     │
│  Updates every 2 min │
└──────────────────────┘
Color: Orange (#f59e0b)
Border: Solid orange
Status: Mid-progress
```

### ⚪ Gray (<50%)
```
┌──────────────────────┐
│  🎓 35.20%          │  ← Static
│  Early Stage 🌱      │
│  Updates every 2 min │
└──────────────────────┘
Color: Gray (#6b7280)
Border: Solid gray
Status: Just getting started
```

---

## Status Labels

| Percentage | Status Label | Emoji | Animation |
|------------|-------------|-------|-----------|
| ≥99.5% | "Graduating Soon!" | 🚀 | Pulse |
| 95-99.4% | "Almost There!" | 🎯 | Pulse |
| 90-94.9% | "Nearly Ready" | 📈 | None |
| 75-89.9% | "Progressing" | 💪 | None |
| 50-74.9% | "Building Up" | 🏗️ | None |
| <50% | "Early Stage" | 🌱 | None |

---

## Animation Examples

### High Priority (≥95%)
```
╔════════════════╗
║ 🎓 99.12% 🚀  ║  ← Pulsing glow effect
║ Graduating     ║     (opacity 1.0 → 0.85)
║ Soon!          ║
╚════════════════╝
  ↑ Draws attention
```

### Normal Priority (<95%)
```
┌────────────────┐
│ 🎓 78.40%     │  ← Static, no animation
│ Progressing 💪 │
│ Updates 2 min  │
└────────────────┘
```

---

## Hover Effect

All graduation cards have a subtle hover effect:

```
Before hover:          After hover:
┌─────────────┐       ┌─────────────┐
│ 🎓 92.45%  │       │ 🎓 92.45%  │  ← Lifted up
│ Almost      │   →   │ Almost      │  ← Shadow appears
│ There! 🎯   │       │ There! 🎯   │
└─────────────┘       └─────────────┘
                         ↑ transform: translateY(-1px)
```

---

## Mobile Layout

On mobile devices, the graduation card remains fully visible and responsive:

```
┌─────────────────────────┐
│   Profile Pic  $0.123   │
│                +12.5%    │
│                          │
│   ┌──────────────────┐  │
│   │ 🎓 92.45% 🚀    │  │
│   │ Almost There!    │  │
│   │ Updates 2 min    │  │
│   └──────────────────┘  │
│                          │
│   [Social Icons]         │
└─────────────────────────┘
```

---

## Where It Appears

### ✅ Visible In:
- **Graduating Tab** - All tokens
- When `coin.status === 'graduating'`
- When `coin.isPumpFun === true`
- When `baseBalance` or `bondingCurveProgress` exists

### ❌ Not Visible In:
- Trending Tab
- New Tab
- Custom Filter Tab
- Non-Pump.fun tokens

---

## Data Sources

### Primary (Preferred):
```javascript
baseBalance: 850000000  // From Bitquery
↓
calculateGraduationPercentage(850000000)
↓
92.45%
```

### Fallback:
```javascript
bondingCurveProgress: "92.45"  // Pre-calculated by backend
↓
parseFloat("92.45")
↓
92.45%
```

---

## Update Behavior

### Timeline:
```
T+0:00   Fetch graduating coins from Bitquery
         ↓
T+0:00   Calculate graduation %
         ↓
T+0:00   Display to user (instant)
         ↓
T+2:00   Cache expires
         ↓
T+2:00   Re-fetch from Bitquery
         ↓
T+2:00   Update display with new %
```

### Visual Update:
When percentage changes, the card smoothly updates:
```
Before:              After:
┌──────────────┐    ┌──────────────┐
│ 🎓 92.45%   │ →  │ 🎓 93.12%   │
│ Almost       │    │ Almost       │
│ There! 🎯    │    │ There! 🎯    │
└──────────────┘    └──────────────┘
```

---

## Real-World Examples

### Example 1: Ready to Graduate
```
Token: $MOON
baseBalance: 985000000
Progress: 99.12%

Display:
╔═══════════════════╗
║ 🎓 99.12% 🚀     ║  ← PULSING!
║ Graduating Soon!  ║
║ Updates every 2min║
╚═══════════════════╝
Color: Bright Green
Action: Watch closely!
```

### Example 2: Building Momentum
```
Token: $DOGE2
baseBalance: 650000000
Progress: 78.40%

Display:
┌───────────────────┐
│ 🎓 78.40%        │  ← Static
│ Progressing 💪    │
│ Updates every 2min│
└───────────────────┘
Color: Yellow
Action: Monitor progress
```

### Example 3: Early Stage
```
Token: $NEWTOKEN
baseBalance: 350000000
Progress: 35.20%

Display:
┌───────────────────┐
│ 🎓 35.20%        │  ← Static
│ Early Stage 🌱    │
│ Updates every 2min│
└───────────────────┘
Color: Gray
Action: Keep an eye on it
```

---

## Tips for Users

### 🎯 Best Practices:
1. **Look for 95%+** - These tokens are about to graduate
2. **Watch the pulse** - Pulsing animation = high priority
3. **Check every 2 min** - Percentages update with cache
4. **Green = Go** - Focus on green cards first
5. **Rocket emoji** - Indicates ≥99% (almost there!)

### 📊 Strategy:
- **Day traders**: Focus on 95%+ tokens
- **Early birds**: Look at 75-90% range
- **Risk takers**: Explore <75% for bigger gains
- **Safe plays**: Only trade 99%+ tokens

---

## Troubleshooting

### Not Seeing Graduation %?
✅ Make sure you're on the **Graduating** tab  
✅ Token must have `status: 'graduating'`  
✅ Check if `baseBalance` or `bondingCurveProgress` exists  
✅ Refresh the page if it's been >2 minutes  

### Percentage Not Updating?
✅ Updates happen every **2 minutes**  
✅ Check backend cache refresh  
✅ Verify Bitquery API is responding  
✅ Look at browser console for errors  

### Colors Look Wrong?
✅ Check color mapping in graduationCalculator.js  
✅ Verify CSS is loaded correctly  
✅ Clear browser cache  
✅ Check if dark mode is enabled  

---

**Status**: ✅ Feature Complete  
**Last Updated**: 2025-10-17  
**Version**: 1.0.0
