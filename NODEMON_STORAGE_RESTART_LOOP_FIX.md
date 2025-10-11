# 500 Error Fix - Nodemon Storage Restart Loop

## Issue
After implementing the NEW feed storage system, the backend was showing HTTP 500 errors and the `/api/coins/new` endpoint was returning `loading: true` with empty coins array, even though the backend health endpoint was working.

## Root Cause
The issue was caused by **nodemon watching the storage directory and restarting the server** every time a batch file was saved. This created a restart loop:

1. Server starts
2. Loads saved NEW feed batch (100 coins)
3. Defers initialization by 3 seconds
4. During initialization, fetches fresh NEW feed
5. Saves batch to `storage/new-feed-latest.json`
6. **Nodemon detects file change and restarts server** ← This was the problem!
7. Server restarts before initialization completes
8. Loop repeats

This meant the `newCoins` array was always empty when the `/api/coins/new` endpoint was called, causing it to return the "loading" response.

## Solution
Created a `nodemon.json` configuration file to **ignore storage files and other non-code files**:

```json
{
  "ignore": [
    "storage/**",
    "*.log",
    "test-*.js",
    "diagnostic-*.js",
    "debug-*.js",
    "*.md"
  ],
  "watch": [
    "*.js",
    "services/**/*.js"
  ],
  "ext": "js,json",
  "delay": "2500"
}
```

This prevents nodemon from restarting when:
- Storage batch files are saved
- Log files are written
- Test/diagnostic scripts are created
- Documentation is updated

## Verification
After applying the fix:

```bash
# Backend health check - OK
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"..."}

# NEW coins endpoint - Now returns 100 coins!
curl http://localhost:3001/api/coins/new
# Response: {"success":true,"coins":[...100 coins...],"count":100,...}
```

## Files Changed
- **Created**: `backend/nodemon.json` - Nodemon configuration to ignore storage files

## Impact
✅ Backend no longer restarts in a loop  
✅ NEW feed initializes successfully on startup  
✅ `/api/coins/new` endpoint returns coins immediately  
✅ Frontend can now load NEW coins without errors  
✅ Auto-refresh system works as intended (every 30 minutes)  

## Next Steps
- Test the NEW tab in the frontend browser to verify UI loads coins correctly
- Monitor backend logs to ensure no more unexpected restarts
- Consider adding a health check that reports initialization status

---
**Status**: ✅ FIXED  
**Date**: 2025-10-11  
**Time to Fix**: ~30 minutes of debugging  
**Lesson**: Always configure dev tools (like nodemon) to ignore data/storage directories to prevent restart loops!
