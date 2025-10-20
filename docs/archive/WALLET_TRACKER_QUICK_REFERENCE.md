# 🔍 Wallet Tracker - Quick Reference

## 🎯 Quick Start

### For Users:
1. Open any coin
2. Click "Load Top Traders"
3. **Click any wallet address** → Modal opens with wallet analytics
4. Click × or backdrop to close

### For Developers:
```javascript
// Use the WalletModal anywhere:
import WalletModal from './components/WalletModal';

const [selectedWallet, setSelectedWallet] = useState(null);

// Make any wallet clickable:
<span 
  className="wallet-link"
  onClick={() => setSelectedWallet(walletAddress)}
>
  {walletAddress}
</span>

// Render modal:
{selectedWallet && (
  <WalletModal 
    walletAddress={selectedWallet}
    onClose={() => setSelectedWallet(null)}
  />
)}
```

---

## 📡 API Endpoint

```bash
GET /api/wallet/:owner
```

**Example:**
```bash
curl http://localhost:3001/api/wallet/F8dt9XqZ7P3m4kLsN2YjVb5CxRwTuE1H6vM8
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sol_balance": 10.5,
    "total_value_usd": 1500,
    "total_pnl": 2500,
    "win_rate": 65.5,
    "total_trades": 150
  },
  "cached": false
}
```

---

## 🎨 Components

### WalletModal.jsx
**Props:**
- `walletAddress` (string, required): Solana wallet address
- `onClose` (function, required): Close handler

**Features:**
- Auto-fetches data on mount
- Loading state
- Error handling with retry
- Responsive design
- Click outside to close

---

## 🔧 Configuration

### Backend Cache:
```javascript
const WALLET_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
```

### Environment:
```bash
SOLANA_TRACKER_API_KEY=your_key_here
```

---

## 📊 Data Displayed

| Section | Fields |
|---------|--------|
| **Balance** | SOL Balance, Total Value (USD) |
| **Trading** | Invested, Realized, PnL, PnL % |
| **Activity** | Total Trades, Buys, Sells |
| **Performance** | Win Rate, Wins, Losses |
| **Additional** | Avg Hold Time, Tokens Held, Trade Dates |

---

## 🎯 Integration Points

### Current:
✅ **Top Traders List** - Wallets clickable

### Future:
🔜 **Live Transactions** - Add wallet info to tx data
🔜 **Portfolio View** - User's own wallet tracking
🔜 **Wallet Search** - Direct wallet lookup

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| 404 on API call | Check backend is running on port 3001 |
| No data returned | Verify API key in `.env` |
| Modal won't close | Check `onClose` prop is passed |
| Styling broken | Import `WalletModal.css` |

---

## 📱 Responsive Breakpoints

- **Desktop**: Max 900px width, centered
- **Tablet** (≤768px): Full width with padding
- **Mobile** (≤480px): Full screen

---

## 🚀 Performance

- **Cache**: 3-minute TTL reduces API calls
- **Lazy Load**: Modal only renders when needed
- **Optimized**: No unnecessary re-renders
- **Fast**: Data fetches on-demand

---

## ✅ Testing Checklist

- [ ] Backend running on port 3001
- [ ] Frontend running on port 5175
- [ ] Click wallet opens modal
- [ ] Data loads correctly
- [ ] Error state shows on API failure
- [ ] Modal closes via × button
- [ ] Modal closes via backdrop click
- [ ] Responsive on mobile
- [ ] No console errors

---

## 🎉 That's It!

Simple, powerful wallet tracking integrated seamlessly into your app!
