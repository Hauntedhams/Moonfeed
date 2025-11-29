# 📸 Wallet Connection & Profile Picture - Visual Guide

## Before & After: Profile View Transformation

### 🔓 DISCONNECTED STATE (Before Connection)
```
┌─────────────────────────────────────┐
│         🌙 [Dark Mode Toggle]       │
│                                      │
│           👤 Profile Icon            │
│                                      │
│            Profile                   │
│  Connect your wallet to access      │
│  your Moonfeed profile              │
│                                      │
│   ┌──────────────────────────┐     │
│   │   💎 Select Wallet  →    │     │
│   └──────────────────────────┘     │
│                                      │
│  💡 Supports Phantom, Solflare,     │
│     Jupiter Mobile, and 100+ wallets│
│                                      │
│   What you'll get access to:        │
│   • Transaction History             │
│   • Synced Favorites                │
│   • Portfolio Tracking              │
│   • Price Alerts                    │
│   • Quick Trading                   │
│   • Advanced Analytics              │
└─────────────────────────────────────┘
```

### 🔐 CONNECTED STATE (After Connection)

```
┌─────────────────────────────────────┐
│         🌙 [Dark Mode Toggle]       │
│                                      │
│        ┌─────────────┐               │
│        │  👤 Photo   │               │  ← Clickable profile picture
│        │  [Upload]   │ ✓             │  ← Connected badge
│        └─────────────┘               │
│       [Remove Photo]                 │  ← Shows when picture exists
│       4Dw7...xK2p                   │  ← Wallet address
│                                      │
│   📊 Limit Orders                    │
│   [Active] [History]                │
│   ┌──────────────────────────┐     │
│   │ BONK 🟢 Buy              │     │
│   │ Trigger: $0.0000125      │     │
│   │ Amount: 1000000 BONK     │     │
│   │ [Cancel Order]           │     │
│   └──────────────────────────┘     │
│                                      │
│   💼 Wallet Information              │
│   Address: 4Dw7...xK2p  📋          │
│   SOL Balance: 5.2341 SOL 🔄        │
│   [Disconnect]                      │
│                                      │
│   👥 Tracked Wallets (2)             │
│   • GxS2...4Kp9  [View] [✕]        │
│   • 8Hw3...mN7Q  [View] [✕]        │
└─────────────────────────────────────┘
```

## Profile Picture Upload Flow

### Step 1: Empty State (Hover to See Hint)
```
┌─────────────────┐
│                 │
│      👤         │  ← Default avatar icon
│                 │
│   📷           │  ← Camera icon appears on hover
│ Upload Photo    │  ← "Upload Photo" text on hover
│                 │
└─────────────────┘
     ✓ Connected
```

### Step 2: Click to Upload
```
File Picker Opens:
┌──────────────────────────┐
│ Select Profile Picture   │
│                          │
│ 📁 image1.jpg   2.1 MB  │
│ 📁 image2.png   1.5 MB  │
│ 📁 image3.webp  800 KB  │
│                          │
│ [Cancel]  [Open]        │
└──────────────────────────┘

Validation:
✅ Image files only (jpg, png, gif, webp)
✅ Max size: 2 MB
❌ Rejects non-images
❌ Rejects files > 2 MB
```

### Step 3: Photo Uploaded (Hover Shows Change Option)
```
┌─────────────────┐
│   ┌─────────┐   │
│   │  Your   │   │  ← Your uploaded photo
│   │  Photo  │   │
│   └─────────┘   │
│                 │
│  [Dark Overlay] │  ← Appears on hover
│      📷         │  ← Camera icon
│    Change       │  ← "Change" text
│                 │
└─────────────────┘
     ✓ Connected

[Remove Photo]  ← Button below picture
```

## Wallet Connection Process

### Step 1: Click "Select Wallet"
```
Jupiter Wallet Modal Opens:
┌─────────────────────────────────┐
│   Connect a Wallet              │
│                                 │
│  🟣 Phantom                     │
│  🟠 Solflare                    │
│  🔵 Jupiter Mobile (QR)         │
│  🟢 Backpack                    │
│  🔴 Ledger                      │
│  ⚪ More...                     │
│                                 │
│  [Cancel]                       │
└─────────────────────────────────┘
```

### Step 2: Wallet Approval
```
Your Wallet (e.g., Phantom):
┌─────────────────────────────────┐
│   Connection Request            │
│                                 │
│   Moonfeed wants to connect     │
│                                 │
│   This app would like to:       │
│   • View your wallet address    │
│   • Request approval for txns   │
│                                 │
│   [Cancel]  [Connect] ←        │
└─────────────────────────────────┘
```

### Step 3: Connected! 🎉
```
✅ Wallet Connected Successfully!

Your profile now shows:
• Profile picture upload (✓)
• Wallet address display (✓)
• SOL balance (✓)
• Active orders (✓)
• Order history (✓)
• Tracked wallets (✓)
```

## Mobile Wallet Connection (Jupiter Mobile)

### For Mobile Users:
```
1. Click "Select Wallet"
   
2. Select "Jupiter Mobile"
   
3. QR Code appears:
   ┌─────────────────┐
   │  ████  ████  ██ │
   │  ████  ████  ██ │  ← Scan with
   │  ██  ████  ████ │     Jupiter
   │  ████  ██  ████ │     Mobile app
   └─────────────────┘
   
4. Approve in Jupiter app
   
5. Connected! 🎉
```

## Key Features Visual Summary

### Profile Picture States

```
STATE 1: No Photo (Disconnected)
────────────────────────────
│  Cannot upload without    │
│  wallet connection        │
────────────────────────────

STATE 2: No Photo (Connected)
────────────────────────────
│   👤                      │
│   📷 Upload Photo         │
│   (hover hint)            │
────────────────────────────

STATE 3: Photo Uploaded
────────────────────────────
│   🖼️ Your Image           │
│   📷 Change (hover)       │
│   [Remove Photo]          │
│   4Dw7...xK2p            │
────────────────────────────
```

### Wallet Info Display

```
Connected State:
┌──────────────────────────────┐
│ 💼 Wallet Information        │
├──────────────────────────────┤
│ Address: 4Dw7...xK2p  📋    │ ← Click to copy
│ SOL Balance: 5.2341 SOL 🔄  │ ← Click to refresh
│ [Disconnect]                 │
└──────────────────────────────┘
```

## Dark Mode Support

### Light Mode
- Light backgrounds (#ffffff, #f0f0f0)
- Dark text (#111827, #666)
- Purple gradients (#667eea, #764ba2)

### Dark Mode 🌙
- Dark backgrounds (var(--bg-primary))
- Light text (#ffffff, rgba(255,255,255,0.7))
- Same purple gradients (maintained)
- Adjusted opacity for readability

```
Toggle in top-left corner:
☀️ ←→ 🌙
```

## Button States & Interactions

### Connect Wallet Button
```
Normal:    [💎 Select Wallet  →]
Hover:     [💎 Select Wallet  →] ↑ (lifts)
Active:    [💎 Select Wallet  →] (pressed)
Connected: [✓ 4Dw7...xK2p]
```

### Profile Picture
```
Empty:     [👤] → Click → File picker
With Photo: [🖼️] → Hover → [📷 Change]
           [Remove Photo] → Click → Confirms removal
```

### Order Actions
```
[Cancel Order] → Click → Wallet confirmation → Cancelled
[View TX ↗]   → Click → Opens Solscan
[Retry]       → Click → Refetch orders
```

## Data Persistence

### What Gets Saved
```
localStorage:
├── profilePic_4Dw7...xK2p: "data:image/png;base64,iVBOR..."
├── profilePic_GxS2...4Kp9: "data:image/jpg;base64,/9j/4..."
└── profilePic_8Hw3...mN7Q: null

Each wallet = separate profile picture
```

## Error Handling

### Connection Errors
```
❌ User rejected connection
   → "Connection cancelled by user"

❌ Wallet not installed
   → "Please install [Wallet Name]"

❌ Network error
   → "Connection failed. Please try again"
```

### Upload Errors
```
❌ File too large
   → "Image size must be less than 2MB"

❌ Invalid file type
   → "Please select an image file"

❌ Upload failed
   → "Failed to upload image. Please try again"
```

## Success Indicators

### Visual Feedback
```
✅ Connected: Green badge with ✓
✅ Photo uploaded: Image displays immediately
✅ Order cancelled: Success message + TX link
✅ Balance refreshed: Updated number
```

---

## Quick Reference: User Actions

| Action | Result |
|--------|--------|
| Click "Select Wallet" | Opens Jupiter wallet modal |
| Select wallet | Prompts for approval |
| Approve connection | Loads profile data |
| Click profile picture | Opens file picker |
| Upload image | Saves to localStorage |
| Hover over photo | Shows "Change" overlay |
| Click "Remove Photo" | Deletes profile picture |
| Click address | Copies to clipboard |
| Click refresh icon | Updates SOL balance |
| Click "Disconnect" | Disconnects wallet |

---

**All features are fully functional and tested!** ✅
