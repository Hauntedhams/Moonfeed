/**
 * MOONSHOT METADATA SERVICE
 * 
 * Fetches token metadata (images, banners, descriptions) from Moonshot.com
 * Many tokens are launched on Moonshot and have rich metadata that other APIs don't have
 * 
 * Features:
 * - Fetch profile images and banners
 * - Get token descriptions and social links
 * - Aggressive caching (metadata rarely changes)
 * - Fallback handling for non-Moonshot tokens
 */

const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const https = require('https');

// HTTPS agent for connection pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  timeout: 10000
});

class MoonshotMetadataService {
  constructor() {
    // Moonshot API endpoints
    this.api = {
      // Direct CDN for images (from examples in your data)
      cdn: 'https://cdn.moonshot.com',
      // Moonshot API (need to test these endpoints)
      base: 'https://api.moonshot.com',
      // Alternative: Use dexscreener which proxies Moonshot images
      dexscreener: 'https://api.dexscreener.com/latest/dex/tokens'
    };
    
    // 🐮 Special case: $MOO token with custom banner
    this.MOO_TOKEN_ADDRESS = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';
    this.MOO_CUSTOM_BANNER = '/assets/moonfeed banner.png'; // Served from frontend
    
    // Aggressive caching since metadata rarely changes
    this.metadataCache = new NodeCache({ 
      stdTTL: 3600 * 24, // 24 hours (metadata is static)
      checkperiod: 3600 
    });
    
    console.log('🌙 Moonshot Metadata Service initialized');
  }

  /**
   * Get Moonshot metadata for a token
   * Tries multiple approaches to find Moonshot-hosted images
   */
  async getMetadata(mintAddress) {
    // Check cache first
    const cacheKey = `moonshot_${mintAddress}`;
    const cached = this.metadataCache.get(cacheKey);
    if (cached) {
      console.log(`✅ [MOONSHOT CACHE] ${mintAddress} - using cached metadata`);
      return cached;
    }

    console.log(`🌙 Fetching Moonshot metadata for ${mintAddress}...`);

    try {
      // Approach 1: Try to get Moonshot data via DexScreener
      // DexScreener often includes Moonshot CDN URLs in their responses
      const dexscreenerData = await this.fetchViaDexscreener(mintAddress);
      
      if (dexscreenerData && this.hasMoonshotImages(dexscreenerData)) {
        console.log(`✅ Found Moonshot images via DexScreener for ${mintAddress}`);
        this.metadataCache.set(cacheKey, dexscreenerData);
        return dexscreenerData;
      }

      // Approach 2: Try Moonshot API directly (if available)
      const moonshotData = await this.fetchDirectFromMoonshot(mintAddress);
      
      if (moonshotData) {
        console.log(`✅ Found Moonshot data via direct API for ${mintAddress}`);
        this.metadataCache.set(cacheKey, moonshotData);
        return moonshotData;
      }

      // Approach 3: Try token metadata from on-chain (might reference Moonshot)
      const onChainData = await this.fetchOnChainMetadata(mintAddress);
      
      if (onChainData) {
        // 🐮 Special case: Add custom banner for $MOO token
        if (mintAddress === this.MOO_TOKEN_ADDRESS) {
          console.log(`🐮 Adding custom banner for $MOO token`);
          onChainData.banner = this.MOO_CUSTOM_BANNER;
        }
        
        if (this.hasMoonshotImages(onChainData)) {
          console.log(`✅ Found Moonshot images in on-chain metadata for ${mintAddress}`);
        } else if (mintAddress === this.MOO_TOKEN_ADDRESS) {
          console.log(`✅ Found on-chain metadata with custom $MOO banner`);
        }
        
        this.metadataCache.set(cacheKey, onChainData);
        return onChainData;
      }

      // 🐮 Special fallback: For $MOO token, always return data with custom banner even if no images found
      if (mintAddress === this.MOO_TOKEN_ADDRESS) {
        console.log(`🐮 Creating fallback metadata for $MOO with custom banner`);
        const mooMetadata = {
          profileImage: null, // Will be set from enrichment
          banner: this.MOO_CUSTOM_BANNER, // Custom banner!
          logo: null,
          image: null,
          description: 'We created TikTok for meme coins! MoonFeed shows curated lists of solana coins about to go to the moon',
          name: 'MoonFeed',
          symbol: 'MOO',
          source: 'moonfeed-custom'
        };
        
        this.metadataCache.set(cacheKey, mooMetadata);
        return mooMetadata;
      }

      console.log(`ℹ️ No Moonshot metadata found for ${mintAddress}`);
      return null;

    } catch (error) {
      console.error(`❌ Error fetching Moonshot metadata for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch metadata via DexScreener (which often includes Moonshot images)
   */
  async fetchViaDexscreener(mintAddress) {
    try {
      const response = await fetch(`${this.api.dexscreener}/${mintAddress}`, {
        timeout: 5000,
        agent: httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return null;
      }

      // Find pair with Moonshot images
      for (const pair of data.pairs) {
        const metadata = this.extractMoonshotMetadata(pair);
        if (metadata) {
          return metadata;
        }
      }

      return null;

    } catch (error) {
      console.warn(`⚠️ DexScreener fetch failed:`, error.message);
      return null;
    }
  }

  /**
   * Try to fetch directly from Moonshot API
   * Note: Moonshot may not have a public API, this is speculative
   */
  async fetchDirectFromMoonshot(mintAddress) {
    try {
      // Try common API patterns
      const endpoints = [
        `${this.api.base}/token/${mintAddress}`,
        `${this.api.base}/v1/token/${mintAddress}`,
        `${this.api.base}/tokens/${mintAddress}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            timeout: 3000,
            agent: httpsAgent,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });

          if (response.ok) {
            const data = await response.json();
            const metadata = this.extractMoonshotMetadata({ info: data });
            if (metadata) {
              return metadata;
            }
          }
        } catch (err) {
          // Continue to next endpoint
          continue;
        }
      }

      return null;

    } catch (error) {
      // Moonshot API might not be public, this is expected
      return null;
    }
  }

  /**
   * Fetch on-chain metadata (might reference Moonshot CDN)
   */
  async fetchOnChainMetadata(mintAddress) {
    try {
      // Approach 1: Try Jupiter token list first
      try {
        const jupResponse = await fetch(`https://tokens.jup.ag/token/${mintAddress}`, {
          timeout: 3000,
          agent: httpsAgent
        });

        if (jupResponse.ok) {
          const data = await jupResponse.json();
          
          // Check if logo URI points to Moonshot or any CDN
          if (data.logoURI) {
            return {
              profileImage: data.logoURI,
              logo: data.logoURI,
              image: data.logoURI,
              banner: null, // Jupiter doesn't have banners
              name: data.name,
              symbol: data.symbol,
              source: data.logoURI.includes('moonshot.com') ? 'moonshot-jupiter' : 'jupiter-onchain'
            };
          }
        }
      } catch (err) {
        // Continue to next approach
      }

      // Approach 2: Try fetching from Solana on-chain metadata using Helius/Metaplex
      try {
        const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || 'c59a0beb-c3c7-48a0-92be-5a6cfdc0b603'}`;
        
        const metadataResponse = await fetch(heliusUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          agent: httpsAgent,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAsset',
            params: {
              id: mintAddress
            }
          })
        });

        if (metadataResponse.ok) {
          const result = await metadataResponse.json();
          
          if (result.result && result.result.content) {
            const content = result.result.content;
            const metadata = content.metadata;
            const links = content.links || {};
            
            // Extract image URLs
            const imageUrl = links.image || content.files?.[0]?.uri || metadata?.image;
            
            if (imageUrl) {
              return {
                profileImage: imageUrl,
                logo: imageUrl,
                image: imageUrl,
                banner: null,
                name: content.metadata?.name || metadata?.name,
                symbol: content.metadata?.symbol || metadata?.symbol,
                description: content.metadata?.description || metadata?.description,
                source: imageUrl.includes('moonshot.com') ? 'moonshot-onchain' : 'onchain'
              };
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ On-chain metadata fetch failed:', err.message);
      }

      // Approach 3: Try Metaboss/Metaplex standard
      try {
        const metaplexUrl = `https://api.metaplex.com/tokens/${mintAddress}`;
        const metaplexResponse = await fetch(metaplexUrl, {
          timeout: 3000,
          agent: httpsAgent,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (metaplexResponse.ok) {
          const data = await metaplexResponse.json();
          
          if (data.image || data.imageUrl || data.logo) {
            const imageUrl = data.image || data.imageUrl || data.logo;
            return {
              profileImage: imageUrl,
              logo: imageUrl,
              image: imageUrl,
              banner: data.banner || null,
              name: data.name,
              symbol: data.symbol,
              description: data.description,
              source: imageUrl.includes('moonshot.com') ? 'moonshot-metaplex' : 'metaplex'
            };
          }
        }
      } catch (err) {
        // Metaplex might not exist or be down
      }

      return null;

    } catch (error) {
      console.warn('⚠️ On-chain metadata error:', error.message);
      return null;
    }
  }

  /**
   * Extract Moonshot metadata from any data source
   */
  extractMoonshotMetadata(pair) {
    const info = pair.info || {};
    const baseToken = pair.baseToken || {};
    
    const metadata = {
      profileImage: null,
      banner: null,
      logo: null,
      image: null,
      description: null,
      socials: {},
      source: 'moonshot'
    };

    // Check all possible image fields for Moonshot CDN URLs
    const imageFields = [
      info.imageUrl,
      info.header,
      baseToken.image,
      pair.image,
      pair.logo
    ];

    for (const imageUrl of imageFields) {
      if (imageUrl && imageUrl.includes('moonshot.com')) {
        // Found a Moonshot-hosted image!
        if (!metadata.profileImage) metadata.profileImage = imageUrl;
        if (!metadata.logo) metadata.logo = imageUrl;
        if (!metadata.image) metadata.image = imageUrl;
        
        // Header images are typically banners
        if (imageUrl === info.header) {
          metadata.banner = imageUrl;
        }
      }
    }

    // If we found any Moonshot images, also extract other metadata
    if (metadata.profileImage || metadata.banner) {
      // Extract description
      if (info.description) {
        metadata.description = info.description;
      }

      // Extract socials
      if (info.socials) {
        info.socials.forEach(social => {
          const type = (social.type || social.platform || '').toLowerCase();
          if (type === 'twitter' || type === 'x') {
            metadata.socials.twitter = social.url;
          } else if (type === 'telegram') {
            metadata.socials.telegram = social.url;
          } else if (type === 'discord') {
            metadata.socials.discord = social.url;
          } else if (type === 'website') {
            metadata.socials.website = social.url;
          }
        });
      }

      if (info.websites && info.websites.length > 0) {
        metadata.socials.website = info.websites[0].url || info.websites[0];
      }

      return metadata;
    }

    return null;
  }

  /**
   * Check if data contains Moonshot-hosted images
   */
  hasMoonshotImages(data) {
    if (!data) return false;
    
    const imageFields = [
      data.profileImage,
      data.banner,
      data.logo,
      data.image
    ];

    return imageFields.some(url => 
      url && typeof url === 'string' && url.includes('moonshot.com')
    );
  }

  /**
   * Batch fetch metadata for multiple tokens
   */
  async batchGetMetadata(mintAddresses, maxConcurrency = 3) {
    console.log(`🌙 Batch fetching Moonshot metadata for ${mintAddresses.length} tokens...`);
    
    const results = [];
    
    for (let i = 0; i < mintAddresses.length; i += maxConcurrency) {
      const batch = mintAddresses.slice(i, i + maxConcurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(mintAddress => this.getMetadata(mintAddress))
      );
      
      batchResults.forEach((result, index) => {
        const mintAddress = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          results.push({ mintAddress, metadata: result.value });
        } else {
          results.push({ mintAddress, metadata: null });
        }
      });
      
      // Rate limiting between batches
      if (i + maxConcurrency < mintAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const found = results.filter(r => r.metadata !== null).length;
    console.log(`✅ Moonshot batch complete: ${found}/${mintAddresses.length} with metadata`);
    
    return results;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cached_tokens: this.metadataCache.keys().length,
      hits: this.metadataCache.getStats().hits,
      misses: this.metadataCache.getStats().misses
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.metadataCache.flushAll();
    console.log('🗑️ Moonshot metadata cache cleared');
  }
}

module.exports = new MoonshotMetadataService();
