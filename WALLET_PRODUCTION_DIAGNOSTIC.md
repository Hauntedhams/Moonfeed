# Wallet Connection Production Issue - Diagnostic Checklist

## Issue
Wallet "Connect Wallet" button works on **localhost** but NOT on **production** (Vercel).

## Quick Diagnostic Steps

### 1. Check Console Errors (CRITICAL)
Open your production site in browser:
1. Open DevTools (F12)
2. Go to Console tab
3. Clear console
4. Click "Connect Wallet"
5. Click "Phantom"
6. **Copy and paste ALL errors/warnings that appear**

Look specifically for:
- `TypeError: ...`
- `notificationCallback...`
- `wallet-vendor...`
- `chunk...`
- Any red errors

### 2. Check Network Tab
1. Open DevTools → Network tab
2. Refresh page
3. Look for these files - they should load with **200 status**:
   - `react-vendor-DmCrio42.js` (or similar hash)
   - `wallet-vendor-_R1IGyZo.js` (or similar hash)
   - `index-BNJprvo-.js` (or similar hash)

**If you see 404 errors**: Vercel hasn't deployed the latest build yet

### 3. Check Wallet Extensions
In production browser console, type:
```javascript
console.log('Phantom:', !!window.solana);
console.log('Solflare:', !!window.solflare);
```

**Should see**: `true` for installed wallets

### 4. Check Build Version
In production console, type:
```javascript
console.log(document.scripts.length);
Array.from(document.scripts).forEach(s => console.log(s.src));
```

Look for `wallet-vendor` chunk with the NEW hash

### 5. Use Debug Tool
Visit your production URL + `/wallet-debug.html`:
```
https://your-production-url.vercel.app/wallet-debug.html
```

This will show:
- ✅ Environment detection
- ✅ Wallet extension detection
- ✅ Build chunk verification
- ✅ Console function tests
- ✅ Direct connection test

## Common Issues & Solutions

### Issue 1: Vercel Hasn't Deployed Yet
**Symptoms**: 
- Still seeing 404s for chunks
- Old chunk names in Network tab

**Solution**:
1. Go to Vercel dashboard
2. Check deployment status
3. If not deploying, trigger manually:
   - Click "Redeploy" button
   - Or use CLI: `vercel --prod`

**How to verify**:
- Deployment shows "Ready" status
- Recent timestamp (within last 10 minutes)
- Commit hash matches: `33fe247`

### Issue 2: Browser Cache
**Symptoms**:
- Page loads old version
- Console shows old errors

**Solution**:
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
2. Or clear cache:
   ```javascript
   // In console:
   localStorage.clear();
   sessionStorage.clear();
   caches.keys().then(names => names.forEach(name => caches.delete(name)));
   location.reload();
   ```
3. Or try incognito/private window

### Issue 3: Wallet Extensions Not Detected
**Symptoms**:
- Console shows `window.solana` is undefined
- Modal shows "Install wallet" for Phantom

**Solution**:
1. Verify Phantom is installed in that browser
2. Unlock Phantom
3. Try different browser
4. Check if browser is blocking extensions

### Issue 4: HTTPS Required
**Symptoms**:
- Wallets work on localhost (http)
- Don't work on production (https)

**Solution**:
- Ensure production URL uses HTTPS
- Vercel automatically provides HTTPS
- Check URL starts with `https://`

### Issue 5: WalletNotification Callbacks Failing
**Symptoms**:
- Console shows: `TypeError: config2.notificationCallback?.onConnecting is not a function`

**Solution**:
- This was fixed in commit `18f4c74`
- Verify Vercel deployed this commit
- Check deployment logs for build errors

### Issue 6: Console.log Stripped in Production
**Symptoms**:
- No console logs appear
- Callbacks don't execute

**Solution**:
- This was fixed in commit `18f4c74`
- Changed `drop_console: false` in vite.config.js
- Verify latest build is deployed

## Localhost vs Production Differences

| Aspect | Localhost | Production |
|--------|-----------|------------|
| Build | Dev mode | Minified |
| Console logs | Always present | Kept (after fix) |
| Hot reload | Yes | No |
| HTTPS | No (http) | Yes (https) |
| URL | localhost:5173 | your-domain.vercel.app |
| Cache | Disabled | Enabled |

## Debug Commands to Run in Production Console

```javascript
// 1. Check environment
console.log('Location:', window.location.href);

// 2. Check wallets
console.log('Phantom:', window.solana);
console.log('Solflare:', window.solflare);

// 3. Check if console works
console.log('Console test');
typeof console !== 'undefined' && console.log('Console is defined');

// 4. Check chunks loaded
console.log('Scripts:', Array.from(document.scripts).map(s => s.src));

// 5. Test direct Phantom connection
if (window.solana) {
  window.solana.connect().then(resp => {
    console.log('Direct connection success:', resp.publicKey.toString());
  }).catch(err => {
    console.error('Direct connection error:', err);
  });
}
```

## Files to Verify on Vercel

These should be the LATEST versions:
1. `frontend/vite.config.js` - Has `drop_console: false`
2. `frontend/src/components/WalletNotification.jsx` - Has callback object structure
3. `frontend/src/main.jsx` - Has wallet adapters initialized

## Verification Steps

### ✅ Code is Correct
- [x] vite.config.js has `drop_console: false`
- [x] WalletNotification is callback object (not React component)
- [x] Wallet adapters properly initialized in main.jsx
- [x] Jupiter wallet adapter in wallet-vendor chunk

### ⏳ Deployment Status
- [ ] Latest commit pushed to GitHub (`33fe247`)
- [ ] Vercel detected the push
- [ ] Vercel build completed successfully
- [ ] Vercel deployment status shows "Ready"

### 🔍 Production Verification
- [ ] Production URL loads (no black screen)
- [ ] No 404 errors in Network tab
- [ ] Wallet extensions detected in console
- [ ] "Connect Wallet" button clickable
- [ ] Modal opens when button clicked
- [ ] Phantom shows in modal
- [ ] Clicking Phantom triggers extension prompt

## Next Steps

1. **Check Vercel dashboard** - Is deployment complete?
2. **Share console errors** - What appears when clicking Connect Wallet?
3. **Visit debug page** - Go to `/wallet-debug.html` on your prod URL
4. **Try direct connection** - Use the debug tool's connection test

## Contact Info for Further Help

If issue persists, provide:
- ✅ Vercel deployment URL
- ✅ Screenshot of Vercel dashboard showing latest deployment
- ✅ Console errors (full text)
- ✅ Network tab screenshot showing loaded chunks
- ✅ Results from `/wallet-debug.html`

This will help diagnose the exact issue!
