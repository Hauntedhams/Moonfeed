# 🎨 Hot Area Visual Architecture

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ .coin-card                                                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ .info-layer-content                                    │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ .charts-section                                  │ │ │
│  │  │                                                  │ │ │
│  │  │  ┌────────────────────────────────────────────┐ │ │ │
│  │  │  │ .chart-nav-hot-area                       │ │ │ │
│  │  │  │ ← 🔥 FULL-WIDTH EVENT CAPTURE ZONE        │ │ │ │
│  │  │  │ (pointer-events: auto, min-height: 60px)  │ │ │ │
│  │  │  │                                            │ │ │ │
│  │  │  │  ╔════════════════════════════════════╗   │ │ │ │
│  │  │  │  ║ .chart-nav-content                ║   │ │ │ │
│  │  │  │  ║ ← Visual container (inset)        ║   │ │ │ │
│  │  │  │  ║ (pointer-events: none)            ║   │ │ │ │
│  │  │  │  ║                                    ║   │ │ │ │
│  │  │  │  ║  ●  ○  ▓▓▓▓▓▓▓▓▓ 45.2% ⓘ          ║   │ │ │ │
│  │  │  │  ║  ↑  ↑        ↑           ↑        ║   │ │ │ │
│  │  │  │  ║  │  │        │           │        ║   │ │ │ │
│  │  │  │  ║ Dot Dot  Progress Bar  Icon       ║   │ │ │ │
│  │  │  │  ║ (click) (click)        (click)    ║   │ │ │ │
│  │  │  │  ╚════════════════════════════════════╝   │ │ │ │
│  │  │  │                                            │ │ │ │
│  │  │  └────────────────────────────────────────────┘ │ │ │
│  │  │                    ↕ 8px gap                     │ │ │
│  │  │  ┌────────────────────────────────────────────┐ │ │ │
│  │  │  │ .charts-horizontal-container               │ │ │ │
│  │  │  │ (horizontal scroll)                        │ │ │ │
│  │  │  │                                            │ │ │ │
│  │  │  │  ┌──────────┐  ┌──────────┐               │ │ │ │
│  │  │  │  │  Clean   │  │ Advanced │               │ │ │ │
│  │  │  │  │  Chart   │  │  Chart   │               │ │ │ │
│  │  │  │  │          │  │          │               │ │ │ │
│  │  │  │  │  📈      │  │  📊      │               │ │ │ │
│  │  │  │  └──────────┘  └──────────┘               │ │ │ │
│  │  │  └────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Event Flow Diagram

### Desktop (Mouse Drag)

```
User Action:  Move cursor over hot area
                      ↓
           ┌──────────────────────┐
           │  .chart-nav-hot-area │
           │  cursor: grab        │ ← Hover state
           └──────────────────────┘
                      ↓
User Action:  Click and hold
                      ↓
           ┌──────────────────────┐
           │  .chart-nav-hot-area │
           │  cursor: grabbing    │ ← Active state
           │  mousedown event     │
           └──────────────────────┘
                      ↓
User Action:  Move mouse left/right
                      ↓
           ┌──────────────────────┐
           │  document.mousemove  │ ← Event on document
           │  Update scrollLeft   │
           └──────────────────────┘
                      ↓
           ┌──────────────────────┐
           │ .charts-horizontal-  │
           │    container         │
           │  scrollLeft changes  │ ← 1:1 tracking
           └──────────────────────┘
                      ↓
User Action:  Release mouse
                      ↓
           ┌──────────────────────┐
           │  document.mouseup    │
           │  Snap to page        │
           └──────────────────────┘
                      ↓
           ┌──────────────────────┐
           │  Update currentPage  │
           │  Update active dot   │
           └──────────────────────┘
```

### Mobile (Touch Swipe)

```
User Action:  Touch hot area
                      ↓
           ┌──────────────────────┐
           │  .chart-nav-hot-area │
           │  touchstart event    │
           └──────────────────────┘
                      ↓
User Action:  Swipe left/right
                      ↓
           ┌──────────────────────┐
           │  touchmove event     │
           │  Update scrollLeft   │
           └──────────────────────┘
                      ↓
           ┌──────────────────────┐
           │ .charts-horizontal-  │
           │    container         │
           │  scrollLeft changes  │ ← 1:1 tracking
           └──────────────────────┘
                      ↓
User Action:  Lift finger
                      ↓
           ┌──────────────────────┐
           │  touchend event      │
           │  Snap to page        │
           └──────────────────────┘
                      ↓
           ┌──────────────────────┐
           │  Update currentPage  │
           │  Update active dot   │
           └──────────────────────┘
```

---

## 🧩 Pointer Events Hierarchy

```
┌─────────────────────────────────────────────────┐
│ .chart-nav-hot-area                             │
│ pointer-events: auto ← 🔥 CAPTURES ALL EVENTS   │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ .chart-nav-content                        │ │
│  │ pointer-events: none ← Passes events UP   │ │
│  │                                           │ │
│  │  ┌────┐  ┌────┐  ┌──────────┐  ┌────┐   │ │
│  │  │ ●  │  │ ○  │  │ Progress │  │ ⓘ  │   │ │
│  │  │Dot │  │Dot │  │   Bar    │  │Icon│   │ │
│  │  └────┘  └────┘  └──────────┘  └────┘   │ │
│  │    ↑       ↑           ↑          ↑     │ │
│  │   auto    auto        none       auto   │ │
│  │  (click)  (click)   (pass thru) (click) │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Key:**
- `auto` = Element captures events (clickable)
- `none` = Element passes events to parent (drag/swipe goes through)

---

## 📏 Dimensions & Spacing

```
┌─ Hot Area Container ──────────────────────────────────┐
│                                                       │
│  Width: 100%                                          │
│  Min-height: 60px ← Fixed, predictable               │
│  Margin: 0 0 8px 0 ← 8px gap below                   │
│                                                       │
│  ┌─ Nav Content (Visual) ─────────────────────────┐  │
│  │                                                │  │
│  │  Padding: 12px 20px                            │  │
│  │  Margin: 0 20px ← Horizontal inset             │  │
│  │  Height: 100%                                  │  │
│  │                                                │  │
│  │  ● ○ ▓▓▓▓▓▓▓▓▓ 45.2% ⓘ                         │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
         ↕ 8px gap
┌─ Charts Container ────────────────────────────────────┐
│                                                       │
│  ┌──────────┐  ┌──────────┐                          │
│  │  Clean   │  │ Advanced │                          │
│  │  Chart   │  │  Chart   │                          │
│  │          │  │          │                          │
│  │  📈      │  │  📊      │                          │
│  └──────────┘  └──────────┘                          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 🎨 Visual States

### Default State
```
┌─────────────────────────────────────┐
│                                     │
│  ● ○ ▓▓▓▓▓▓▓▓▓ 45.2% ⓘ              │
│                                     │
│  Background: rgba(255,255,255,0.02) │
│  Cursor: grab                       │
└─────────────────────────────────────┘
```

### Hover State
```
┌─────────────────────────────────────┐
│                                     │
│  ● ○ ▓▓▓▓▓▓▓▓▓ 45.2% ⓘ              │
│                                     │
│  Background: rgba(255,255,255,0.04) │ ← Brighter
│  Cursor: grab                       │
└─────────────────────────────────────┘
```

### Active/Dragging State
```
┌─────────────────────────────────────┐
│                                     │
│  ● ○ ▓▓▓▓▓▓▓▓▓ 45.2% ⓘ              │
│                                     │
│  Background: rgba(255,255,255,0.06) │ ← Even brighter
│  Cursor: grabbing                   │
└─────────────────────────────────────┘
```

---

## 🔄 Scroll Behavior

### Before Swipe (Page 0)
```
Charts Container Scroll Position:
┌──────────────────────────────────────┐
│ scrollLeft: 0                        │
│                                      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │                     │
│   Clean Chart  │  Advanced (hidden)  │
│    (visible)   │                     │
│                │                     │
└──────────────────────────────────────┘
```

### During Swipe (Scrolling)
```
Charts Container Scroll Position:
┌──────────────────────────────────────┐
│ scrollLeft: 150 (50% between pages)  │
│                                      │
│ ▓▓▓▓▓▓ │ ▓▓▓▓▓▓                      │
│  Clean │ Advanced                    │
│ (half) │ (half)                      │
│        │                             │
└──────────────────────────────────────┘
```

### After Swipe (Page 1, Snapped)
```
Charts Container Scroll Position:
┌──────────────────────────────────────┐
│ scrollLeft: 300 (1 page width)       │
│                                      │
│                  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓    │
│  Clean (hidden)  │  Advanced Chart   │
│                  │    (visible)      │
│                  │                   │
└──────────────────────────────────────┘
```

---

## 🧠 Key Concepts

### 1️⃣ Hot Area = Event Capture Zone
- **Purpose:** Capture ALL touch/mouse events in nav region
- **Size:** Full width, fixed height (60px)
- **Behavior:** Doesn't block child interactions (dots, icon)

### 2️⃣ Nav Content = Visual Presentation
- **Purpose:** Display nav dots, progress bar visually
- **Size:** Inset by 20px horizontally for aesthetic
- **Behavior:** Passes events through to hot area parent

### 3️⃣ Selective Clickability
- **Nav dots:** `pointer-events: auto` (clickable)
- **Info icon:** `pointer-events: auto` (clickable)
- **Progress bar:** `pointer-events: none` (pass through for drag)

### 4️⃣ 1:1 Scroll Tracking
- Touch/mouse movement directly updates `scrollLeft`
- No thresholds, multipliers, or artificial delays
- Natural, native-feeling horizontal scroll

---

## 📱 Responsive Adaptation

### Desktop
```
Hot Area Width: 100% of charts-section
Nav Content Inset: 20px margin
Cursor: grab → grabbing
Event: mousedown/mousemove/mouseup
```

### Tablet
```
Hot Area Width: 100% of charts-section
Nav Content Inset: 20px margin (same)
Cursor: default (no grab cursor needed)
Event: touchstart/touchmove/touchend
```

### Mobile
```
Hot Area Width: 100% of charts-section
Nav Content Inset: 20px margin (same)
Cursor: default
Event: touchstart/touchmove/touchend
Touch-action: pan-y (allow vertical scroll on page)
```

---

## ✅ Visual Checklist

When inspecting in browser DevTools:

### Hot Area Container
- [x] Element: `.chart-nav-hot-area`
- [x] Width: Full width of parent
- [x] Height: ~60px (may vary slightly)
- [x] Margin-bottom: 8px
- [x] Computed style `pointer-events`: `auto`
- [x] Computed style `cursor`: `grab`

### Nav Content
- [x] Element: `.chart-nav-content`
- [x] Parent: `.chart-nav-hot-area`
- [x] Margin: `0 20px` (horizontal inset)
- [x] Padding: `12px 20px`
- [x] Computed style `pointer-events`: `none`

### Nav Dots
- [x] Elements: `.nav-dot` (2 of them)
- [x] Parent: `.chart-nav-content`
- [x] Computed style `pointer-events`: `auto`
- [x] Computed style `cursor`: `pointer`

### Graduation Icon
- [x] Element: `.graduation-info-icon`
- [x] Computed style `pointer-events`: `auto`
- [x] Computed style `cursor`: `pointer`

---

## 🎉 Final Result

```
┌─────────────────────────────────────────────┐
│  🔥 HOT AREA (100% width, 60px height)      │
│  ┌───────────────────────────────────────┐  │
│  │  VISUAL CONTENT (inset)               │  │
│  │  ● ○ ▓▓▓▓▓▓▓▓▓ 45.2% ⓘ                │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
              ↕ 8px gap
┌─────────────────────────────────────────────┐
│  📈 Clean Chart    │    📊 Advanced Chart   │
└─────────────────────────────────────────────┘

Swipe ANYWHERE in hot area → Graphs scroll instantly!
```

**Result:** Natural, responsive horizontal navigation that matches user expectations! 🚀
