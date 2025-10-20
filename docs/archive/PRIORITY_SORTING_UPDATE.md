# Priority Sorting Update - Banners & Locked Liquidity First

## Summary
Updated the NEW feed priority sorting algorithm to prioritize coins with banners and locked liquidity at the top of the feed, ensuring the most trustworthy and complete coin listings appear first.

## Changes Made

### Updated `sortCoinsByPriority()` Function
**File:** `/backend/rugcheckService.js` (Lines 298-330)

### New Priority Order:

1. **🏆 HIGHEST PRIORITY:** Coins with **BOTH** banner **AND** locked liquidity
   - These are the most complete and trustworthy listings
   - Example: Has a banner image AND liquidity is locked/burned

2. **🔒 Second Priority:** Coins with **locked liquidity** (even without banner)
   - Shows safety and commitment from developers
   - Includes: `liquidityLocked === true` OR `lockPercentage > 50%` OR `burnPercentage > 50%`

3. **🎨 Third Priority:** Coins with **banners** (even without locked liquidity)
   - Shows effort in presentation and marketing
   - Includes: `banner`, `bannerUrl`, or `imageUrl` fields

4. **✨ Fourth Priority:** Coins with **all features**
   - Complete profile with all enrichment data

5. **📊 Fifth Priority:** Coins sorted by **overall priority score**
   - Calculated based on volume, market cap, socials, etc.

## Code Implementation

```javascript
function sortCoinsByPriority(coins) {
  return coins.map(coin => ({
    ...coin,
    priorityScore: calculatePriorityScore(coin)
  })).sort((a, b) => {
    // 1. HIGHEST PRIORITY: Coins with BOTH banner AND locked liquidity
    const aHasBoth = (a.banner || a.bannerUrl || a.imageUrl) && 
                     (a.liquidityLocked === true || a.lockPercentage > 50 || a.burnPercentage > 50);
    const bHasBoth = (b.banner || b.bannerUrl || b.imageUrl) && 
                     (b.liquidityLocked === true || b.lockPercentage > 50 || b.burnPercentage > 50);
    if (aHasBoth && !bHasBoth) return -1;
    if (!aHasBoth && bHasBoth) return 1;
    
    // 2. Second priority: Coins with locked liquidity
    const aHasLockedLiq = a.liquidityLocked === true || a.lockPercentage > 50 || a.burnPercentage > 50;
    const bHasLockedLiq = b.liquidityLocked === true || b.lockPercentage > 50 || b.burnPercentage > 50;
    if (aHasLockedLiq && !bHasLockedLiq) return -1;
    if (!aHasLockedLiq && bHasLockedLiq) return 1;
    
    // 3. Third priority: Coins with banners
    const aHasBanner = a.banner || a.bannerUrl || a.imageUrl;
    const bHasBanner = b.banner || b.bannerUrl || b.imageUrl;
    if (aHasBanner && !bHasBanner) return -1;
    if (!aHasBanner && bHasBanner) return 1;
    
    // 4. Fourth priority: Coins with all features
    if (a.priorityScore.hasAllFeatures && !b.priorityScore.hasAllFeatures) return -1;
    if (!a.priorityScore.hasAllFeatures && b.priorityScore.hasAllFeatures) return 1;
    
    // 5. Finally, sort by overall priority score
    return b.priorityScore.score - a.priorityScore.score;
  });
}
```

## Impact

### What Users Will See:
- **Top of feed:** Fully enriched coins with banners AND locked liquidity (safest, most complete)
- **Near top:** Coins with locked liquidity (safe but may lack banner)
- **Middle:** Coins with banners (good presentation but liquidity not locked)
- **Bottom:** Other coins sorted by priority score

### Benefits:
1. **Safety First:** Users see coins with locked liquidity at the top
2. **Quality Indicators:** Banners show developer effort and professionalism
3. **Better User Experience:** Most trustworthy coins appear first
4. **Encourages Enrichment:** Incentivizes projects to complete their profiles

## Applies To:
- ✅ NEW Feed (`/api/coins/new`)
- ✅ TRENDING Feed (`/api/coins/trending`)
- ✅ Custom Filters Feed (`/api/coins/custom`)

All feeds use the same `sortCoinsByPriority()` function, so the priority logic applies everywhere.

## Priority Score Components

The underlying priority score still considers:
- **Banner:** 20 points
- **Locked Liquidity:** 25 points
- **Profile Picture:** 15 points
- **Volume:** 20 points
- **Market Cap:** 10 points
- **Socials:** 10 points
- **Rugcheck Verified:** 5 points
- **Risk Level:** -10 points (penalty)

But now the sorting explicitly prioritizes banner + locked liquidity combinations before falling back to the overall score.

## Testing

After backend restart, verify:
1. Coins with banner AND locked liquidity appear at the top
2. Coins with only locked liquidity appear next
3. Coins with only banners appear after that
4. Other coins follow sorted by priority score

Check console logs during enrichment to see priority scores being calculated.

## Git Commits

**Commit 1:** `6cb6266` - Updated NEW feed parameters
**Commit 2:** `7a2fc4d` - Prioritize coins with banners and locked liquidity

**Changes:**
- 1 file changed: `backend/rugcheckService.js`
- 21 insertions, 2 deletions

---

**Date:** October 11, 2025
**Status:** ✅ Complete and Pushed to GitHub
