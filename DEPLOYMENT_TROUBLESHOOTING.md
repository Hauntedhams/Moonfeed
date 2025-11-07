# Deployment Troubleshooting Guide

## Current Issue: "No Coins Found" + Service Worker Error

### What Was Fixed:
1. **Service Worker Cache Error** - Fixed in commit `b4e5ce7`
   - Removed `/src/main.jsx` from cache list (doesn't exist in production)
   - Bumped cache version to `v2` to force refresh
   - This fixes: `Failed to execute 'addAll' on 'Cache'` error

### Backend Status: ✅ WORKING
```bash
# Test graduating endpoint:
curl https://moonfeed-backend.onrender.com/api/coins/graduating

# Test new endpoint:
curl https://moonfeed-backend.onrender.com/api/coins/new

# Test trending endpoint:
curl https://moonfeed-backend.onrender.com/api/coins/trending
```

All endpoints are returning data successfully.

---

## If "No Coins Found" Persists After Deployment

### Step 1: Clear Service Worker Cache
**On Desktop (Chrome/Edge):**
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Service Workers** on left
4. Click **Unregister** next to Moonfeed service worker
5. Go to **Cache Storage** on left
6. Right-click `moonfeed-v1` and `moonfeed-v2` → **Delete**
7. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

**On Mobile (iOS Safari):**
1. Settings → Safari → **Clear History and Website Data**
2. Or: Settings → Safari → Advanced → Website Data → Remove moonfeed.app

**On Mobile (Android Chrome):**
1. Chrome → Settings → Privacy → **Clear browsing data**
2. Check "Cached images and files"
3. Click Clear data

### Step 2: Check Network Requests
Open DevTools → Network tab:
1. Filter by `coins`
2. Look for requests to `/api/coins/*`
3. Check if they return `200 OK`
4. Check response has `{"success": true, "coins": [...]}`

**Expected requests:**
- `/api/coins/trending` (default tab)
- `/api/coins/new` (new tab)
- `/api/coins/graduating` (graduating tab)

### Step 3: Check Console Errors
Look for these specific errors:

**Good logs (working):**
```
✅ TRENDING LOAD: Successfully loaded X trending coins
📊 Loaded X coins (mobile/desktop mode)
```

**Bad logs (not working):**
```
❌ Error: HTTP 500
❌ Invalid response format - no coins array
⏳ Backend still loading NEW feed, will retry
```

### Step 4: Force Render.com Deployment
If Render hasn't deployed yet:
1. Go to https://dashboard.render.com
2. Find your frontend service
3. Click **Manual Deploy** → **Deploy latest commit**
4. Wait 2-3 minutes for build to complete

### Step 5: Check API Configuration
Look at `frontend/src/config/api.js`:
```javascript
export const API_CONFIG = {
  COINS_API: 'https://moonfeed-backend.onrender.com/api/coins',
  // ...
};
```

Make sure it points to the correct backend URL.

---

## Common Issues & Solutions

### Issue: Service Worker Caching Old Files
**Symptoms:** Old UI showing, errors about missing files
**Solution:** 
- Bump `CACHE_NAME` in `frontend/public/sw.js`
- Clear browser cache
- Hard refresh

### Issue: Backend Cold Start
**Symptoms:** First load shows "no coins", works after refresh
**Solution:**
- Backend on Render free tier spins down after 15 min
- First request wakes it up (takes 30-60 seconds)
- This is normal, subsequent requests are fast

### Issue: CORS Errors
**Symptoms:** Console shows `CORS policy` errors
**Solution:**
- Check `backend/server.js` has correct CORS config
- Verify `origin` allows your frontend domain

### Issue: "No Coins Found" on Specific Tab
**Symptoms:** Works on trending, fails on new/graduating
**Solution:**
- Check specific endpoint: `curl https://moonfeed-backend.onrender.com/api/coins/new`
- May need to wait for backend to warm up cache
- New/graduating endpoints have 5min cache, may be empty on first load

---

## Deployment Status Checks

### Frontend (Render.com):
```bash
# Check if site is live:
curl -I https://moonfeed.app

# Should return: HTTP/2 200
```

### Backend (Render.com):
```bash
# Check health:
curl https://moonfeed-backend.onrender.com/health

# Check coins:
curl https://moonfeed-backend.onrender.com/api/coins/trending | head -c 200
```

### GitHub:
```bash
# Check latest commit deployed:
git log --oneline -3
```

Should show:
```
b4e5ce7 fix: service worker cache issue
6a21266 fix: enable universal scroll-through
```

---

## Emergency Rollback

If deployment is completely broken:

```bash
# Rollback to previous commit:
git revert HEAD
git push origin main

# Or reset to specific commit:
git reset --hard <commit-hash>
git push origin main --force
```

---

## Contact Info

If issue persists after all troubleshooting:
1. Check Render.com dashboard for build errors
2. Check browser console for specific error messages
3. Verify API endpoints are responding with data
4. Try incognito/private browsing mode (bypasses cache)

---

**Last Updated:** November 7, 2025  
**Status:** Service worker cache fixed, awaiting deployment propagation
