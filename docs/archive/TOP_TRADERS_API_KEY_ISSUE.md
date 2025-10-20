# Top Traders Button - API Key Issue

## Problem
The Top Traders button is not working because the Solana Tracker API is returning a 401 error (Invalid API key).

## Root Cause
```
curl https://api.moonfeed.app/api/top-traders/HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC

Response: {"success":false,"error":"Failed to fetch top traders","details":"API error: 401 - {\"error\":\"Invalid API key\"}"}
```

The backend code at `/backend/server.js` line 515-600 is correctly implemented and uses:
- `SOLANA_TRACKER_API_KEY` environment variable
- `SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io'`

## Solution Required

### Check Render Environment Variables
1. Go to Render dashboard for the backend service
2. Navigate to Environment tab
3. Verify that `SOLANA_TRACKER_API_KEY` is set
4. Check if the API key is valid and not expired

### Verify API Key
The API key should be obtained from: https://solanatracker.io

### Testing After Fix
```bash
# Test the endpoint after setting the API key
curl "https://api.moonfeed.app/api/top-traders/HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC"

# Expected response:
{
  "success": true,
  "data": [...traders array...],
  "count": 10,
  "cached": false,
  "timestamp": "2025-10-14T..."
}
```

## Backend Code Status
✅ Endpoint correctly implemented at `/api/top-traders/:coinAddress`
✅ Frontend calling correct endpoint  
✅ Caching logic in place (5 minute TTL)
✅ Error handling for stale cache fallback
❌ API key not configured or invalid on Render

## Action Items
1. [ ] Check Render environment variables for `SOLANA_TRACKER_API_KEY`
2. [ ] Verify API key is valid at https://solanatracker.io
3. [ ] Add/update the API key in Render
4. [ ] Redeploy backend service (or let it auto-deploy)
5. [ ] Test the endpoint again
6. [ ] Test on mobile after fix

## Related Files
- `/backend/server.js` (lines 515-600) - Top traders endpoint
- `/frontend/src/components/TopTradersList.jsx` - Frontend component
- `/frontend/src/components/CoinCard.jsx` - Button that opens the modal
