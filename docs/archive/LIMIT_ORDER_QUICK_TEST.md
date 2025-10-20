# 🚀 Quick Test Guide - Jupiter Limit Orders

## ✅ Backend is Now Running!

### What Just Happened:
1. ✅ Implemented complete Jupiter Trigger service
2. ✅ Added Ultra API referral integration (70 BPS)
3. ✅ Backend restarted with new service
4. ✅ All endpoints ready to use

---

## 🧪 5-Minute Test

### Step 1: Check Backend Logs
Look for this on startup:
```
[Jupiter Trigger] Using referral account: FxWWHg9LPWiH9ixwv5CWq6eepTg1A6EYEpMzXC6s98xD with 70 BPS
```

### Step 2: Open Frontend
```bash
# In new terminal (if not running)
cd frontend
npm run dev
```

### Step 3: Test Limit Order
1. **Connect Wallet** (Phantom/Solana wallet)
2. **Find a coin** in the feed
3. **Click "Limit Order"** button
4. **Fill in order**:
   - Amount: `0.1 SOL` (or any amount)
   - Price: Set to `+10%` above current
   - Expiry: `7 days`
5. **Click "Create Limit Order"**
6. **Sign in wallet**

### Step 4: Check Logs
**Frontend Console:**
```
💰 Creating limit order...
✅ Order created: { orderId: "abc123..." }
```

**Backend Console:**
```
[Jupiter Trigger] Creating order: {
  "maker": "YourWallet...",
  "referralAccount": "FxWWHg9LPWiH9ixwv5CWq6eepTg1A6EYEpMzXC6s98xD",
  "feeBps": 70
}
[Jupiter Trigger] Order created successfully
```

### Step 5: View Orders
- Click **"View Orders"** in the modal
- Should show your new limit order
- Shows: Price, Amount, Status, Expiry

---

## 🐛 Troubleshooting

### ❌ "Wallet not connected"
**Fix**: Click "Connect Wallet" button first

### ❌ "Missing required parameters"
**Fix**: Ensure all fields filled (amount, price, expiry)

### ❌ "API timeout"
**Fix**: Check internet connection, try again

### ❌ "Transaction failed"
**Fix**: 
- Check wallet balance (need SOL for gas)
- Verify amounts are valid numbers
- Try smaller amount

### ❌ Orders not showing
**Fix**: 
- Wait a few seconds, refresh
- Check wallet address is correct
- Verify order was created (check logs)

---

## 📊 What You Should See

### In Frontend:
- ✅ Modal opens with form
- ✅ Can enter amount and price
- ✅ Price percentage auto-calculates
- ✅ Shows estimated output
- ✅ "Create Limit Order" button enabled
- ✅ Success message after signing

### In Backend:
- ✅ Request received
- ✅ Order parameters logged
- ✅ Referral account added
- ✅ API call to Jupiter
- ✅ Response returned to frontend

### In Wallet:
- ✅ Transaction popup shows
- ✅ Can see order details
- ✅ Sign to create order
- ✅ Order appears in history

---

## 💰 Referral Fee Verification

### How to Confirm:
1. Create an order
2. Check backend logs for:
   ```
   "referralAccount": "FxWWHg9LPWiH9ixwv5CWq6eepTg1A6EYEpMzXC6s98xD"
   "feeBps": 70
   ```
3. When order fills, 0.70% goes to referral account

### Example:
- Order: 1 SOL → 1000 TOKENS
- Fee: 0.007 SOL (~$XXX USD)
- You get: 0.993 SOL worth of tokens
- Referral gets: 0.007 SOL

---

## 🎯 Success Checklist

After testing, you should see:

- [ ] ✅ Backend started without errors
- [ ] ✅ Frontend shows limit order button
- [ ] ✅ Modal opens with form
- [ ] ✅ Can fill all fields
- [ ] ✅ "Create" button works
- [ ] ✅ Wallet popup shows transaction
- [ ] ✅ Can sign transaction
- [ ] ✅ Success message appears
- [ ] ✅ Order shows in "View Orders"
- [ ] ✅ Can cancel order
- [ ] ✅ Backend logs show referral account

---

## 📝 Next Actions

### If All Works:
🎉 **Congratulations!** Your limit order system is live!
- Test with real (small) orders
- Monitor referral fees
- Gather user feedback

### If Issues:
1. Check this guide's troubleshooting section
2. Review `LIMIT_ORDER_IMPLEMENTATION_COMPLETE.md`
3. Check backend/frontend console logs
4. Verify wallet connection

---

## 🔗 Related Files

- **Backend Service**: `/backend/services/jupiterTriggerService.js`
- **Backend Routes**: `/backend/routes/trigger.js`
- **Frontend Modal**: `/frontend/src/components/TriggerOrderModal.jsx`
- **Full Guide**: `LIMIT_ORDER_IMPLEMENTATION_COMPLETE.md`
- **ENV Config**: `/backend/.env` (referral settings)

---

**Ready? Open your app and try creating a limit order!** 🚀

Questions? Check the logs first - they're very verbose and helpful!
