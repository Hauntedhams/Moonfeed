/**
 * Jupiter Ultra Search API Routes
 * Enhanced token search with rich metadata
 */

const express = require('express');
const router = express.Router();
const jupiterUltraSearchService = require('../services/jupiterUltraSearchService');

/**
 * GET /api/search
 * Search for tokens by symbol, name, or mint address
 */
router.get('/', async (req, res) => {
  try {
    const { query, sort, verifiedOnly, minLiquidity, minMarketCap, excludeSuspicious } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    // Search tokens
    const searchResult = await jupiterUltraSearchService.searchTokens(query);

    if (!searchResult.success) {
      return res.status(500).json(searchResult);
    }

    let { results } = searchResult;

    // Apply filters if provided
    if (verifiedOnly || minLiquidity || minMarketCap || excludeSuspicious) {
      results = jupiterUltraSearchService.filterTokens(results, {
        verifiedOnly: verifiedOnly === 'true',
        minLiquidity: minLiquidity ? parseFloat(minLiquidity) : undefined,
        minMarketCap: minMarketCap ? parseFloat(minMarketCap) : undefined,
        excludeSuspicious: excludeSuspicious === 'true'
      });
    }

    // Sort if specified
    if (sort) {
      results = jupiterUltraSearchService.sortTokens(results, sort);
    }

    res.json({
      success: true,
      results,
      total: results.length,
      query
    });
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/multiple
 * Search for multiple tokens at once
 */
router.post('/multiple', async (req, res) => {
  try {
    const { queries } = req.body;

    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: 'queries array is required'
      });
    }

    const result = await jupiterUltraSearchService.searchMultipleTokens(queries);
    res.json(result);
  } catch (error) {
    console.error('Error in multiple search endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search/trending
 * Get trending tokens based on volume and price change
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Search for popular tokens (you can customize this query)
    const result = await jupiterUltraSearchService.searchTokens('SOL,BONK,WIF,PEPE,POPCAT');

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Sort by combination of volume and price change
    const trending = result.results
      .filter(t => t.volume24h && t.priceChange24h)
      .sort((a, b) => {
        const scoreA = (a.volume24h || 0) * (1 + Math.abs(a.priceChange24h || 0) / 100);
        const scoreB = (b.volume24h || 0) * (1 + Math.abs(b.priceChange24h || 0) / 100);
        return scoreB - scoreA;
      })
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      results: trending,
      total: trending.length
    });
  } catch (error) {
    console.error('Error in trending endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search/safety/:mintAddress
 * Get safety score for a specific token
 */
router.get('/safety/:mintAddress', async (req, res) => {
  try {
    const { mintAddress } = req.params;

    const result = await jupiterUltraSearchService.searchTokens(mintAddress);

    if (!result.success || result.results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    const token = result.results[0];
    const safetyScore = jupiterUltraSearchService.calculateSafetyScore(token);

    res.json({
      success: true,
      mintAddress,
      safetyScore,
      audit: token.audit,
      organicScore: token.organicScore,
      organicScoreLabel: token.organicScoreLabel,
      isVerified: token.isVerified,
      isSus: token.isSus
    });
  } catch (error) {
    console.error('Error in safety endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
