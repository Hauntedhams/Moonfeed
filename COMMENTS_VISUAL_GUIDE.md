# 🎨 Comments Section - Visual Guide

## Before & After

### BEFORE: Help Bubble (?)
```
┌─────────────────────────────┐
│                             │
│    🏠 Token Feed View      │
│                             │
│                             │
│                             │
│                             │
│                          ┌──┐
│                          │? │  ← Help info bubble
│                          └──┘
└─────────────────────────────┘
```

### AFTER: Comments Section (💬)
```
┌─────────────────────────────┐
│                             │
│    🏠 Token Feed View      │
│    💰 Viewing: $MOON       │
│                             │
│                             │
│                             │
│                          ┌──┐
│                          │💬│  ← Comments bubble
│                          │5 │  ← Comment count
│                          └──┘
└─────────────────────────────┘
```

## When Opened - Connected Wallet

```
┌─────────────────────────────────────┐
│  💬 Comments  $MOON                 │
│                                  ×  │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Share your thoughts...        │ │
│  │                               │ │
│  │                          0/500│ │
│  │                    [Post]     │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👛 8xY..9zL     2h ago        │ │
│  │ Great project! To the moon! 🚀│ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👛 4aB..3cD     5h ago        │ │
│  │ Love the concept, solid team! │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👛 9eF..2gH     1d ago        │ │
│  │ Just bought some, LFG! 💎     │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
            ▼
         ┌─────┐
         │ 💬  │
         │  5  │
         └─────┘
```

## When Opened - No Wallet Connected

```
┌─────────────────────────────────────┐
│  💬 Comments  $MOON                 │
│                                  ×  │
├─────────────────────────────────────┤
│                                     │
│            🔒                       │
│                                     │
│   Connect your wallet to join      │
│      the conversation               │
│                                     │
│      [Connect Wallet]               │
│                                     │
├─────────────────────────────────────┤
│  Existing Comments                  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👛 8xY..9zL     2h ago        │ │
│  │ Great project! To the moon! 🚀│ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
            ▼
         ┌─────┐
         │ 💬  │
         │  1  │
         └─────┘
```

## Mobile View

```
┌───────────────┐
│               │
│  Token Feed   │
│               │
│               │
│               │
│               │
│            ┌─┐│
│            │💬││  ← Smaller
│            │3 ││     on mobile
│            └─┘│
└───────────────┘
```

## Color Scheme

- **Button Background**: Purple gradient (`#667eea` → `#764ba2`)
- **Header**: Matching purple gradient
- **Comment Cards**: White with light border
- **Hover States**: Purple tint (`#667eea`)
- **Active Button**: Rotated 90° with inverted gradient
- **Text**: Dark gray (`#1f2937`) on light backgrounds
- **Timestamps**: Light gray (`#9ca3af`)

## Interaction Flow

```
User Flow:
1. Browse tokens → See purple comment bubble
2. Click bubble → Panel slides up
3a. If wallet connected:
    → See comment form
    → Type message (max 500 chars)
    → Click "Post"
    → Comment appears instantly
3b. If wallet NOT connected:
    → See "Connect Wallet" prompt
    → Click button
    → Wallet connection modal
    → After connecting → Can post
4. View existing comments for this token
5. Click X or outside → Panel closes
```

## Responsive Breakpoints

**Desktop (> 768px)**
- Panel width: 380px
- Panel height: max 600px
- Button size: 56px

**Mobile (≤ 768px)**
- Panel width: calc(100vw - 32px)
- Panel height: max 500px
- Button size: 50px

## States & Feedback

### Loading State
```
┌───────────────────┐
│    ⟳ Loading...   │
│                   │
│   (spinner)       │
└───────────────────┘
```

### Empty State
```
┌───────────────────┐
│      💭           │
│                   │
│  No comments yet  │
│                   │
│  Be the first!    │
└───────────────────┘
```

### Error State
```
┌───────────────────────────┐
│ ⚠️ Rate limit exceeded    │
│ Please wait before posting│
└───────────────────────────┘
```

### Success Animation
```
New comment slides in from top
with fade effect ✨
```

## Key Features Visualized

### 1. Character Counter
```
┌─────────────────────────┐
│ This is my comment...   │
│                  24/500 │ ← Real-time count
│            [Post]       │
└─────────────────────────┘
```

### 2. Auto-resize Textarea
```
Short:     Long:
┌────┐     ┌────┐
│Hi! │     │This│
│    │     │is a│
└────┘     │long│
           │text│
           └────┘
           Auto-expands!
```

### 3. Comment Count Badge
```
No comments:   Has comments:
  ┌───┐          ┌───┐
  │💬 │          │💬 │
  └───┘          │42 │ ← Badge appears
                 └───┘
```

### 4. Timestamp Formatting
```
Just now  →  within 60s
2m ago    →  within 60min
3h ago    →  within 24h
2d ago    →  within 7d
Oct 15    →  older than 7d
```

### 5. Wallet Display
```
Full address:
8xY4mN9zLpQrT3wV5aB2cE1dF6gH7iJ8k

Displayed as:
👛 8xY..J8k
```

---

## Summary of Changes

✅ **Replaced**: Help Bubble (?) → Comments Section (💬)
✅ **Location**: Bottom right, fixed position
✅ **Per-Coin**: Each token has separate comments
✅ **Wallet-Gated**: Must connect to post
✅ **Real-time**: Comments update live
✅ **Rate Limited**: Max 10/hour per wallet
✅ **Responsive**: Works on all devices
✅ **Animated**: Smooth slide-up panel
✅ **Accessible**: Keyboard nav, ARIA labels
✅ **Polished**: Modern purple gradient UI

The old help bubble is completely gone, replaced with a fully functional social feature! 🎉
