# Frontend "Failed to Load Coins" Fix Guide

## Problem
The Vercel frontend shows "failed to load coins" even though the backend API (https://api.moonfeed.app) is working correctly.

## Root Cause
**Vite environment variables must be set in Vercel's dashboard at BUILD TIME**, not just in `.env.production`.

When Vite builds the application, it replaces `import.meta.env.VITE_API_URL` with the actual value **during the build process**. This means:
- Environment variables in `.env.production` are only used during LOCAL builds
- For Vercel deployments, you MUST set environment variables in the Vercel dashboard
- The variables are "baked into" the JavaScript bundle at build time

## Solution

### Step 1: Set Environment Variable in Vercel Dashboard

1. Go to: https://vercel.com/hauntedhams/moonfeed (or your Vercel project)
2. Click **Settings** → **Environment Variables**
3. Add the following environment variable:

```
Name: VITE_API_URL
Value: https://api.moonfeed.app
Environments: Production, Preview, Development (select all)
```

4. Click **Save**

### Step 2: Redeploy

After adding the environment variable, you MUST redeploy:

**Option A: Trigger via Git (recommended)**
```bash
git commit --allow-empty -m "Trigger redeploy with env vars"
git push origin main
```

**Option B: Redeploy from Vercel Dashboard**
1. Go to **Deployments**
2. Click the three dots on the latest deployment
3. Click **Redeploy**
4. Make sure "Use existing Build Cache" is **UNCHECKED** (important!)

### Step 3: Verify

After deployment completes:

1. Open: https://moonfeed.app
2. Open browser console (F12 → Console tab)
3. Look for this log message:
   ```
   🌐 API Config initialized: {
     environment: 'production',
     baseUrl: 'https://api.moonfeed.app',
     coinsApi: 'https://api.moonfeed.app/api/coins'
   }
   ```

4. Test API connection:
   - Open the diagnostic page: `/test-frontend-api-connection.html`
   - Or use browser console:
   ```javascript
   fetch('https://api.moonfeed.app/api/coins/trending?limit=1')
     .then(r => r.json())
     .then(d => console.log('✅ API Working:', d))
     .catch(e => console.error('❌ API Error:', e))
   ```

## Technical Details

### How Vite Environment Variables Work

**Local Development:**
```javascript
// Vite reads from .env.local or .env.development
console.log(import.meta.env.VITE_API_URL); // "http://localhost:3001"
```

**Production Build:**
```javascript
// Vite reads from Vercel environment variables (NOT .env.production)
// Value is replaced at build time, becomes:
console.log("https://api.moonfeed.app"); // Literal string in bundle
```

### Current Frontend Logic

File: `frontend/src/config/api.js`
```javascript
const getApiBaseUrl = () => {
  // 1. Try Vite env var (set at BUILD TIME by Vercel)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Fallback to localhost for local dev
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // 3. Fallback to production backend
  return 'https://api.moonfeed.app';
};
```

**Currently:** Because `VITE_API_URL` is not set in Vercel, the build uses the fallback (`https://api.moonfeed.app`), which *should* work. But if there's a CORS or network issue, the frontend will fail.

## Debugging Steps

### 1. Check Current Build Output

View the bundled JavaScript to see what URL is compiled in:

```bash
# From your local machine
curl -s https://moonfeed.app | grep -o "https://api.moonfeed.app" | head -1
```

If this returns nothing, the API URL is NOT in the bundle, meaning the frontend doesn't know where to connect.

### 2. Check Browser Network Tab

1. Open https://moonfeed.app
2. Open DevTools (F12) → **Network** tab
3. Filter by "Fetch/XHR"
4. Look for requests to `/api/coins/trending`
5. Check:
   - **Request URL**: Should be `https://api.moonfeed.app/api/coins/trending`
   - **Status**: Should be `200 OK`
   - **Response**: Should contain `{"success": true, "coins": [...]}`

### 3. Check CORS Headers

```bash
curl -I -X OPTIONS \
  -H "Origin: https://moonfeed.app" \
  -H "Access-Control-Request-Method: GET" \
  https://api.moonfeed.app/api/coins/trending
```

Should return:
```
access-control-allow-origin: https://moonfeed.app
```

If it returns `*` or nothing, CORS may be blocking the request.

## Common Issues & Fixes

### Issue 1: CORS Error
**Symptom:** Console shows "CORS policy blocked"
**Fix:** Backend CORS configuration in `backend/server.js` already includes `https://moonfeed.app`

### Issue 2: 503 Service Unavailable
**Symptom:** `/api/coins/new` returns 503
**Fix:** This is normal for first 30 seconds after backend starts. Wait or use `/api/coins/trending` instead.

### Issue 3: Network Timeout
**Symptom:** Request takes >30s and times out
**Fix:** Check Render backend logs for blocking operations. Health checks should be fast.

### Issue 4: Wrong API URL
**Symptom:** Requests go to wrong domain
**Fix:** Set `VITE_API_URL` in Vercel and redeploy.

## Verification Checklist

- [ ] Environment variable `VITE_API_URL=https://api.moonfeed.app` set in Vercel
- [ ] Redeployed WITHOUT build cache after adding env var
- [ ] Browser console shows correct `baseUrl` in API config log
- [ ] Network tab shows requests going to `https://api.moonfeed.app`
- [ ] API returns `200 OK` with coin data
- [ ] No CORS errors in console
- [ ] Frontend displays coins correctly

## Next Steps

1. **Set the environment variable in Vercel** (most important)
2. **Redeploy** (trigger fresh build)
3. **Test using the diagnostic HTML page**
4. **Check browser console and network tab**

If issues persist after following these steps, provide:
- Screenshot of Vercel environment variables page
- Browser console logs when loading the site
- Browser network tab showing the API request
