import { useState, useEffect, useRef } from 'react';
import { API_CONFIG } from '../config/api.js';

/**
 * Hook to fetch live price on-demand from Solana blockchain
 * Fetches price ONLY when coin becomes visible
 * 
 * @param {string} mintAddress - Token mint address
 * @param {boolean} isVisible - Whether the coin card is visible
 * @param {number} fallbackPrice - Initial price from API
 * @returns {object} { price, isLoading, error, lastUpdate }
 */
export function useOnDemandPrice(mintAddress, isVisible = true, fallbackPrice = null) {
  const [price, setPrice] = useState(fallbackPrice);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  
  const fetchedRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Only fetch if visible and haven't fetched yet
    if (!isVisible || !mintAddress || mintAddress.length < 32) {
      return;
    }

    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${API_CONFIG.COINS_API}/price/${mintAddress}`, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.price) {
          setPrice(data.price);
          setPriceChangePercent(data.priceChangeInstant || 0);
          setLastUpdate(data.timestamp);
          fetchedRef.current = true;
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch on-demand price for ${mintAddress.substring(0, 8)}:`, err.message);
        setError(err.message);
        // Keep using fallback price on error
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch when visible
    if (!fetchedRef.current) {
      fetchPrice();
    }

    // Set up interval to refresh price every 10 seconds while visible
    intervalRef.current = setInterval(() => {
      if (isVisible && fetchedRef.current) {
        fetchPrice();
      }
    }, 10000); // 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [mintAddress, isVisible]);

  return {
    price: price || fallbackPrice,
    isLoading,
    error,
    lastUpdate,
    priceChangePercent,
    isLive: fetchedRef.current
  };
}
