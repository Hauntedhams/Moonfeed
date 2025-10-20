# VERCEL DEPLOYMENT FIX - Environment Variables Issue

## Problem Identified ✅

**Localhost works, but production (moonfeed.app) fails with "failed to load coins"**

## Root Cause

Vite environment variables from `.env.production` are **NOT** automatically available during Vercel builds. The `.env.production` file is only used for local production builds, not for Vercel deployments.

## Solution Applied

### 1. Updated `frontend/vercel.json`

Added build-time environment variables to ensure they're available during the Vite build process:

```json
{
  "env": {
    "NODE_ENV": "production",
    "VITE_API_URL": "https://api.moonfeed.app"
  },
  "build": {
    "env": {
      "VITE_API_URL": "https://api.moonfeed.app",
      "VITE_ENV": "production"
    }
  }
}
```

**Note:** The `build.env` section is critical because Vite needs these variables at BUILD TIME to replace `import.meta.env.VITE_API_URL` in the code.

## Deployment Steps

### Step 1: Commit and Push Changes

```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3

# Add the updated vercel.json
git add frontend/vercel.json

# Commit
git commit -m "fix: Add VITE_API_URL to vercel.json for production deployment"

# Push to trigger Vercel deployment
git push origin main
```

### Step 2: Verify Deployment

1. Wait for Vercel to complete the deployment (usually 1-2 minutes)
2. Check Vercel dashboard: https://vercel.com/
3. Look for the new deployment with the commit message

### Step 3: Test the Live Site

1. Open https://moonfeed.app in a new incognito window
2. Open DevTools (F12) → Console
3. Look for the API config log:
   ```
   🌐 API Config initialized: {
     environment: 'production',
     baseUrl: 'https://api.moonfeed.app',
     coinsApi: 'https://api.moonfeed.app/api/coins'
   }
   ```
4. Verify coins are loading

### Step 4: Verify API Calls

In the browser Network tab (F12 → Network → Fetch/XHR):
- Should see requests to `https://api.moonfeed.app/api/coins/trending`
- Status should be `200 OK`
- Response should contain coin data

## Alternative: Set Environment Variables in Vercel Dashboard

If the `vercel.json` approach doesn't work, you can also set environment variables directly in the Vercel dashboard:

1. Go to: https://vercel.com/[your-project]/settings/environment-variables
2. Add:
   - Name: `VITE_API_URL`
   - Value: `https://api.moonfeed.app`
   - Environments: Production, Preview, Development (all checked)
3. Click **Save**
4. **Important:** Redeploy from the Deployments page (don't use cached build)

## Why This Happens

### How Vite Environment Variables Work

**Build Time (Critical):**
```javascript
// During build, Vite replaces this:
const url = import.meta.env.VITE_API_URL;

// With the actual value:
const url = "https://api.moonfeed.app";
```

**Runtime (Too Late):**
- Environment variables are NOT available at runtime in the browser
- They must be injected during the build process
- `.env.production` only works for local builds, not Vercel

### Vercel Build Process

1. Vercel clones your repo
2. Runs `npm install` or `npm ci`
3. Runs `npm run build` (which calls Vite)
4. **During this build step**, Vite needs the environment variables
5. Without them, `import.meta.env.VITE_API_URL` becomes `undefined`
6. The fallback URL logic kicks in, but may not work correctly

## Verification After Deployment

### Check 1: JavaScript Bundle Contains API URL

```bash
# This should find the API URL in the bundle
curl -s https://moonfeed.app | grep -o 'src="/assets/index-[^"]*\.js"' | head -1
# Copy the path, then:
curl -s https://moonfeed.app/assets/index-[HASH].js | grep -o 'api.moonfeed.app'
```

If it doesn't appear, the environment variable wasn't set during build.

### Check 2: Browser Console Logs

Open https://moonfeed.app and check console for:
```
🌐 API Config initialized: {
  environment: 'production',
  baseUrl: 'https://api.moonfeed.app',
  ...
}
```

If `baseUrl` is wrong or `undefined`, the env var wasn't passed to Vite.

### Check 3: Network Requests

In DevTools → Network tab:
- Filter by "Fetch/XHR"
- Should see requests to `https://api.moonfeed.app`
- NOT to `undefined` or wrong URL

## Common Issues

### Issue 1: Still Getting Undefined After Deployment
**Cause:** Vercel used cached build
**Fix:** In Vercel dashboard → Deployments → Click "..." → Redeploy → **UNCHECK** "Use existing Build Cache"

### Issue 2: Changes Not Reflecting
**Cause:** Browser cache
**Fix:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R) or use incognito mode

### Issue 3: CORS Errors After Fix
**Cause:** Backend CORS not configured
**Fix:** Already fixed in `backend/server.js` - includes https://moonfeed.app in allowed origins

## Files Changed

- ✅ `frontend/vercel.json` - Added build-time environment variables

## What This Fixes

- ✅ Frontend will correctly connect to backend API in production
- ✅ API URL will be compiled into the JavaScript bundle
- ✅ No more "failed to load coins" errors
- ✅ Consistent behavior between localhost and production

## Testing Locally

To test the production build locally before deploying:

```bash
cd frontend

# Build with production env vars
npm run build

# Preview the production build
npm run preview

# Test at http://localhost:4173
```

This simulates the Vercel build process and helps catch issues before deployment.

## Summary

**Problem:** `.env.production` not used by Vercel
**Solution:** Add environment variables to `vercel.json` build config
**Result:** Vite can access `VITE_API_URL` during build and compile it into the bundle

Now push the changes and Vercel will automatically deploy with the correct configuration!
