# ⚠️ IMPORTANT: Add DexCheck API Key to Render

## Action Required

You need to add the DexCheck API key to your Render backend environment variables for the new features to work in production.

### Steps:

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com/

2. **Select Your Backend Service**
   - Click on `moonfeed-backend` (or your backend service name)

3. **Go to Environment**
   - Click "Environment" in the left sidebar

4. **Add New Environment Variable**
   - Click "Add Environment Variable"
   - **Key:** `DEXCHECK_API_KEY`
   - **Value:** `Qu5gsYWuzXLusFjWl1ICv5nI0CK3DnYX`

5. **Save Changes**
   - Click "Save Changes"
   - Render will automatically redeploy with the new variable

### Why This is Needed:

The new DexCheck wallet analytics features require this API key to:
- Detect whale wallets 🐋
- Show top trader rankings 🏆
- Display recent trading activity ⚡
- Fetch maker trades history 📊

Without this key, the wallet analytics will only show Helius data (which still works, but you'll miss the DexCheck enhancements).

### Verify It's Working:

After adding the key and redeployment completes:
1. Visit https://moonfeed.app
2. Click on any wallet address
3. You should see DexCheck sections:
   - Whale Status (if applicable)
   - Top Trader Rankings (if applicable)
   - DexCheck Trading Stats
   - Recent Trading Activity
   - "Enhanced with DexCheck" badge in footer

### Existing Environment Variables:

Make sure these are also set:
- `HELIUS_API_KEY`
- `BIRDEYE_API_KEY`
- `SOLANA_TRACKER_API_KEY`
- `SOLSCAN_API_KEY`
- All other existing keys from your `.env` file

### Check Deployment:

Monitor your Render logs after saving:
- Look for: `[DexCheck] Fetching...` messages
- Should see successful API calls
- No 401 Unauthorized errors

---

**Status:** ⏳ Waiting for environment variable to be added

Once added, the full DexCheck integration will be live! 🚀
