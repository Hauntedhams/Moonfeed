# MOONSHOT METADATA INTEGRATION

## Overview
Added support for fetching token metadata (images, banners, descriptions) from Moonshot.com - a popular platform for launching meme coins on Solana.

## Problem Solved
Many tokens launched on Moonshot have high-quality profile pictures and banners that weren't being displayed in MoonFeed because:
- DexScreener doesn't always have the latest images
- Pump.fun metadata is limited
- Jupiter API doesn't include Moonshot-hosted images

Example: `$MOO` (FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon) has a profile pic and banner on Moonshot that wasn't showing.

## Implementation

### 1. New Service: `moonshotMetadataService.js`
Created a dedicated service that:
- **Fetches Moonshot metadata** via multiple approaches:
  - DexScreener (which often proxies Moonshot images)
  - Direct Moonshot API attempts (if available)
  - On-chain metadata that references Moonshot CDN
  
- **Aggressive caching** (24 hours) since metadata rarely changes
- **Connection pooling** for faster requests
- **Multiple fallback strategies** to ensure we find images when they exist

### 2. Integration into OnDemandEnrichmentService
Updated the enrichment pipeline to include Moonshot:

```javascript
const fastApis = {
  dex: this.fetchDexScreener(mintAddress),
  jupiter: jupiterBatchService.getTokenData(mintAddress),
  pumpfun: this.fetchPumpFunDescription(mintAddress),
  moonshot: moonshotMetadataService.getMetadata(mintAddress) // NEW
};
```

### 3. Priority System
The metadata is applied with the following priority:

**For Images:**
1. Moonshot (highest quality, if available)
2. DexScreener
3. Original coin data

**For Descriptions:**
1. Pump.fun (if available)
2. Moonshot (fallback)
3. None (leave blank)

**For Socials:**
- DexScreener first
- Moonshot fills in missing ones

## How It Works

### Detection
The service detects Moonshot-hosted content by checking for CDN URLs:
```javascript
url.includes('moonshot.com')  // e.g., https://cdn.moonshot.com/[hash].jpg
```

### Example Moonshot CDN URLs
From existing data in the project:
- `https://cdn.moonshot.com/uCjmElDp7JGysk6nmu9i0HIO.jpg`
- `https://cdn.moonshot.com/2t6SATG6z9q99Bse10zIcaGm.jpg`
- `https://cdn.moonshot.com/thXgd1xAT5487FwOFB7c5KXg.jpg`

### Metadata Extracted
- `profileImage` - Token profile picture
- `banner` - Header/banner image
- `logo` - Logo image
- `description` - Token description
- `socials` - Twitter, Telegram, Discord, Website

## Performance Impact
- **No blocking:** Moonshot fetch runs in parallel with other APIs
- **Fast timeout:** 5 seconds max, doesn't slow down enrichment
- **Heavy caching:** 24-hour cache means most lookups are instant
- **Minimal overhead:** Only fetches when coin is viewed/enriched

## Testing the Integration

### Manual Test for $MOO
```bash
# In the backend directory
node -e "
const service = require('./services/moonshotMetadataService');
service.getMetadata('FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon')
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
"
```

### Expected Result
```json
{
  "profileImage": "https://cdn.moonshot.com/[hash].jpg",
  "banner": "https://cdn.moonshot.com/[hash].jpg",
  "logo": "https://cdn.moonshot.com/[hash].jpg",
  "image": "https://cdn.moonshot.com/[hash].jpg",
  "description": "...",
  "socials": {
    "twitter": "https://twitter.com/...",
    "telegram": "https://t.me/...",
    "website": "https://..."
  },
  "source": "moonshot"
}
```

## Frontend Display
The frontend should automatically pick up these images when the coin is enriched:
- Profile picture shows in the token card
- Banner shows when expanded
- Images are already passed in the coin object

## Monitoring
Check logs for Moonshot metadata:
```
🌙 Fetching Moonshot metadata for [mintAddress]...
✅ Found Moonshot images via DexScreener for [mintAddress]
✅ Phase 1: Moonshot metadata applied (XXXms)
```

## Cache Management
```javascript
// Get cache stats
const stats = moonshotMetadataService.getCacheStats();
console.log(stats);
// { cached_tokens: 150, hits: 1245, misses: 87 }

// Clear cache if needed
moonshotMetadataService.clearCache();
```

## Benefits
1. **Better UX** - Tokens show their actual branding
2. **Moonshot Support** - All Moonshot-launched tokens get proper images
3. **No Breaking Changes** - Gracefully degrades if Moonshot data unavailable
4. **Fast** - Parallel fetch + aggressive caching = instant on second view
5. **Future-proof** - Works with any token that uses Moonshot CDN

## Known Limitations
1. **Moonshot API unknown** - We rely on DexScreener proxying Moonshot data
2. **Only works for Moonshot tokens** - Non-Moonshot tokens fall back to existing sources
3. **CDN dependency** - If Moonshot CDN changes URLs, this may need updates

## Future Improvements
1. Direct Moonshot API integration (if they offer one)
2. Image quality validation
3. Image caching/proxying on our CDN
4. Fallback to IPFS if Moonshot images are down

## Files Changed
- `backend/services/moonshotMetadataService.js` (NEW)
- `backend/services/OnDemandEnrichmentService.js` (UPDATED)
- Added import and integration into enrichment pipeline

## Deployment Notes
- No environment variables needed
- No new dependencies required
- Works with existing infrastructure
- Deploy backend and restart to activate
