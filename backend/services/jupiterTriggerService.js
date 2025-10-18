/**
 * Jupiter Trigger API Service
 * Handles limit orders and trigger orders via Jupiter's Trigger API
 * Includes Ultra API referral integration
 */

const axios = require('axios');

// Jupiter Trigger API base URL - CORRECT endpoint for limit orders
const JUPITER_TRIGGER_API = 'https://lite-api.jup.ag/trigger/v1';

// Ultra API referral configuration from environment
const REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT;
const FEE_BPS = parseInt(process.env.JUPITER_REFERRAL_FEE_BPS) || 70;

/**
 * Create a new trigger/limit order
 * @param {Object} orderParams - Order parameters
 * @returns {Promise<Object>} API response with transaction data
 */
async function createOrder(orderParams) {
  try {
    const {
      maker,
      payer, // Add payer parameter (usually same as maker)
      inputMint,
      outputMint,
      makingAmount,
      takingAmount,
      expiredAt,
      orderType = 'limit' // 'limit' or 'stop'
    } = orderParams;

    // Validate required fields
    if (!maker || !inputMint || !outputMint || !makingAmount || !takingAmount) {
      return {
        success: false,
        error: 'Missing required order parameters'
      };
    }

    // Build request payload matching Jupiter Trigger API v1 spec
    const payload = {
      maker,
      payer: payer || maker, // If no payer specified, use maker
      inputMint,
      outputMint,
      params: {
        makingAmount: makingAmount.toString(),
        takingAmount: takingAmount.toString()
      },
      computeUnitPrice: "auto" // Jupiter handles compute unit pricing
    };

    // Add optional expiration (Unix timestamp in seconds)
    if (expiredAt) {
      payload.expiredAt = expiredAt;
    }

    // Add referral account and fee BPS if configured
    if (REFERRAL_ACCOUNT) {
      payload.referralAccount = REFERRAL_ACCOUNT;
      payload.feeBps = FEE_BPS;
      console.log(`[Jupiter Trigger] Using referral account: ${REFERRAL_ACCOUNT} with ${FEE_BPS} BPS`);
    }

    console.log('[Jupiter Trigger] Creating order:', JSON.stringify(payload, null, 2));

    // Call Jupiter Trigger API
    const response = await axios.post(
      `${JUPITER_TRIGGER_API}/createOrder`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('[Jupiter Trigger] Order created successfully');
    
    return {
      success: true,
      data: response.data,
      orderParams: payload
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error creating order:', error.response?.data || error.message);
    console.error('[Jupiter Trigger] Full error:', error.response || error);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || error.message,
      details: error.response?.data,
      statusCode: error.response?.status
    };
  }
}

/**
 * Execute a signed transaction
 * @param {string} signedTransaction - Base64 encoded signed transaction
 * @param {string} requestId - Request ID from createOrder response
 * @returns {Promise<Object>} Execution result with transaction signature
 */
async function executeOrder(signedTransaction, requestId) {
  try {
    if (!signedTransaction) {
      return {
        success: false,
        error: 'Missing signed transaction'
      };
    }

    if (!requestId) {
      return {
        success: false,
        error: 'Missing requestId'
      };
    }

    console.log('[Jupiter Trigger] Executing order with requestId:', requestId);

    const response = await axios.post(
      `${JUPITER_TRIGGER_API}/execute`,
      { 
        signedTransaction,
        requestId
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('[Jupiter Trigger] Order executed successfully:', response.data.signature);
    
    return {
      success: true,
      signature: response.data.signature,
      status: response.data.status,
      data: response.data
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error executing order:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      details: error.response?.data,
      signature: error.response?.data?.signature, // Include signature even if failed
      status: error.response?.data?.status
    };
  }
}

/**
 * Cancel a specific order
 * @param {Object} params - Cancel parameters
 * @returns {Promise<Object>} Cancellation transaction data
 */
async function cancelOrder({ maker, orderId }) {
  try {
    if (!maker || !orderId) {
      return {
        success: false,
        error: 'Missing maker or orderId (order key)'
      };
    }

    console.log(`[Jupiter Trigger] Cancelling order ${orderId} for ${maker}`);

    const response = await axios.post(
      `${JUPITER_TRIGGER_API}/cancelOrder`,
      { 
        maker, 
        order: orderId, // Jupiter API expects 'order' not 'orderId'
        computeUnitPrice: "auto"
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('[Jupiter Trigger] Order cancel transaction created successfully');
    
    return {
      success: true,
      requestId: response.data.requestId,
      transaction: response.data.transaction,
      data: response.data
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error cancelling order:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      details: error.response?.data
    };
  }
}

/**
 * Cancel multiple orders
 * @param {Object} params - Cancel parameters
 * @returns {Promise<Object>} Cancellation transaction data
 */
async function cancelOrders({ maker, orderIds }) {
  try {
    if (!maker) {
      return {
        success: false,
        error: 'Missing maker'
      };
    }

    // If orderIds provided, validate it's an array
    if (orderIds && !Array.isArray(orderIds)) {
      return {
        success: false,
        error: 'orderIds must be an array'
      };
    }

    const orderCount = orderIds ? orderIds.length : 'all';
    console.log(`[Jupiter Trigger] Cancelling ${orderCount} orders for ${maker}`);

    const payload = {
      maker,
      computeUnitPrice: "auto"
    };

    // If specific orders provided, include them (Jupiter expects 'orders' not 'orderIds')
    if (orderIds && orderIds.length > 0) {
      payload.orders = orderIds;
    }

    const response = await axios.post(
      `${JUPITER_TRIGGER_API}/cancelOrders`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('[Jupiter Trigger] Orders cancel transactions created successfully');
    
    return {
      success: true,
      requestId: response.data.requestId,
      transactions: response.data.transactions, // Returns array of transactions
      data: response.data
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error cancelling orders:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      details: error.response?.data
    };
  }
}

/**
 * Get trigger orders for a wallet
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} List of orders
 */
async function getTriggerOrders({ 
  wallet, 
  orderStatus = 'active', // 'active' or 'history' 
  page = 1, 
  includeFailedTx = false,
  inputMint = null,
  outputMint = null
}) {
  try {
    if (!wallet) {
      return {
        success: false,
        error: 'Missing wallet address'
      };
    }

    console.log(`[Jupiter Trigger] Fetching ${orderStatus} orders for ${wallet} (page ${page})`);

    // Build query params according to Jupiter API spec
    const params = {
      user: wallet, // Jupiter API expects 'user' not 'wallet'
      orderStatus, // 'active' or 'history'
      page: page.toString()
    };

    if (includeFailedTx) {
      params.includeFailedTx = 'true';
    }

    if (inputMint) {
      params.inputMint = inputMint;
    }

    if (outputMint) {
      params.outputMint = outputMint;
    }

    const response = await axios.get(
      `${JUPITER_TRIGGER_API}/getTriggerOrders`, // Correct endpoint name
      {
        params,
        timeout: 30000
      }
    );

    console.log(`[Jupiter Trigger] Found ${response.data.orders?.length || 0} orders`);
    
    // Log first order for debugging (if any)
    if (response.data.orders?.length > 0) {
      console.log('[Jupiter Trigger] Sample order structure:', JSON.stringify(response.data.orders[0], null, 2));
      
      // Log timestamp fields specifically
      const firstOrder = response.data.orders[0];
      const firstAccount = firstOrder.account || firstOrder;
      console.log('[Jupiter Trigger] Timestamp fields:', {
        createdAt: firstAccount.createdAt,
        expiredAt: firstAccount.expiredAt,
        createdAtType: typeof firstAccount.createdAt,
        expiredAtType: typeof firstAccount.expiredAt
      });
    }
    
    // Transform and enrich order data for frontend
    const enrichedOrders = await Promise.all((response.data.orders || []).map(async order => {
      // Extract token information from various possible locations in the Jupiter API response
      // Jupiter returns data in order.account for active orders
      const account = order.account || order;
      const inputMint = account.inputMint || order.inputMint;
      const outputMint = account.outputMint || order.outputMint;
      const makingAmount = account.makingAmount || order.makingAmount || '0';
      const takingAmount = account.takingAmount || order.takingAmount || '0';
      
      // Determine order type (buy/sell based on SOL vs token)
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const isBuy = inputMint === SOL_MINT;
      
      // Get token mint (the non-SOL token)
      const tokenMint = isBuy ? outputMint : inputMint;
      
      // Fetch token metadata for accurate symbol and decimals
      let tokenSymbol = null;
      let tokenDecimals = 9; // Default to 9 decimals
      let tokenName = null;
      
      try {
        // Try to fetch token info from Jupiter's token list API
        const tokenResponse = await axios.get(
          `https://tokens.jup.ag/token/${tokenMint}`,
          { timeout: 5000 }
        );
        
        if (tokenResponse.data) {
          tokenSymbol = tokenResponse.data.symbol || null;
          tokenDecimals = tokenResponse.data.decimals || tokenDecimals;
          tokenName = tokenResponse.data.name || null;
        }
      } catch (tokenError) {
        console.log(`[Jupiter Trigger] Could not fetch token metadata from Jupiter for ${tokenMint}`);
      }
      
      // Fallback: Try Solscan API if Jupiter didn't return symbol
      if (!tokenSymbol) {
        try {
          const solscanResponse = await axios.get(
            `https://api.solscan.io/token/meta?token=${tokenMint}`,
            { timeout: 5000 }
          );
          
          if (solscanResponse.data) {
            tokenSymbol = solscanResponse.data.symbol || null;
            if (!tokenName) {
              tokenName = solscanResponse.data.name || null;
            }
            if (solscanResponse.data.decimals !== undefined) {
              tokenDecimals = solscanResponse.data.decimals;
            }
          }
        } catch (solscanError) {
          console.log(`[Jupiter Trigger] Could not fetch token metadata from Solscan for ${tokenMint}`);
        }
      }
      
      // Final fallback: Use shortened mint address as symbol
      if (!tokenSymbol) {
        tokenSymbol = `${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}`;
        console.log(`[Jupiter Trigger] Using mint address as fallback symbol: ${tokenSymbol}`);
      }
      
      // Ensure tokenName has a value
      if (!tokenName) {
        tokenName = tokenSymbol;
      }
      
      // Calculate amounts with correct decimals
      const makingAmountNum = parseFloat(makingAmount) / Math.pow(10, isBuy ? 9 : tokenDecimals);
      const takingAmountNum = parseFloat(takingAmount) / Math.pow(10, isBuy ? tokenDecimals : 9);
      
      // Calculate trigger price (in SOL per token)
      let triggerPrice;
      if (isBuy) {
        // For buy orders: price = SOL spent / tokens received
        triggerPrice = takingAmountNum > 0 ? makingAmountNum / takingAmountNum : 0;
      } else {
        // For sell orders: price = SOL received / tokens sold
        triggerPrice = makingAmountNum > 0 ? takingAmountNum / makingAmountNum : 0;
      }
      
      // Format the amount (tokens for buy, SOL for sell display purposes)
      const displayAmount = isBuy ? takingAmountNum : makingAmountNum;
      
      // Calculate estimated value in SOL
      const estimatedValue = isBuy ? makingAmountNum : takingAmountNum;
      
      // Extract timestamps - Jupiter API returns ISO strings or null
      let createdAt = account.createdAt || order.createdAt;
      let expiredAt = account.expiredAt || order.expiredAt;
      
      // Validate and convert timestamps
      let createdAtISO;
      let expiredAtISO = null;
      
      try {
        // If no valid createdAt, use current time
        if (!createdAt) {
          console.warn('[Jupiter Trigger] No createdAt timestamp, using current time');
          createdAtISO = new Date().toISOString();
        } else if (typeof createdAt === 'string') {
          // Jupiter API returns ISO format strings like "2025-10-18T05:16:20Z"
          const date = new Date(createdAt);
          if (isNaN(date.getTime())) {
            console.warn('[Jupiter Trigger] Invalid createdAt string, using current time');
            createdAtISO = new Date().toISOString();
          } else {
            createdAtISO = date.toISOString();
          }
        } else if (typeof createdAt === 'number') {
          // If it's a number, treat it as Unix timestamp in seconds
          createdAtISO = new Date(Number(createdAt) * 1000).toISOString();
        } else {
          console.warn('[Jupiter Trigger] Unknown createdAt format, using current time');
          createdAtISO = new Date().toISOString();
        }
      } catch (err) {
        console.error('[Jupiter Trigger] Error converting createdAt:', err);
        createdAtISO = new Date().toISOString();
      }
      
      try {
        if (expiredAt) {
          if (typeof expiredAt === 'string') {
            // Jupiter API returns ISO format strings
            const date = new Date(expiredAt);
            if (!isNaN(date.getTime())) {
              expiredAtISO = date.toISOString();
            }
          } else if (typeof expiredAt === 'number') {
            // If it's a number, treat it as Unix timestamp in seconds
            expiredAtISO = new Date(Number(expiredAt) * 1000).toISOString();
          }
        }
      } catch (err) {
        console.error('[Jupiter Trigger] Error converting expiredAt:', err);
        expiredAtISO = null;
      }
      
      // Get order ID/key
      const orderId = order.publicKey || account.publicKey || order.orderKey || account.orderKey;
      
      // Fetch current price from Jupiter Price API
      let currentPrice = null;
      try {
        const priceResponse = await axios.get(
          `https://api.jup.ag/price/v2?ids=${tokenMint}`,
          { timeout: 3000 }
        );
        
        if (priceResponse.data?.data?.[tokenMint]) {
          currentPrice = parseFloat(priceResponse.data.data[tokenMint].price) || null;
        }
      } catch (priceError) {
        console.log(`[Jupiter Trigger] Could not fetch current price from Jupiter for ${tokenMint}`);
      }
      
      // Fallback: If no current price, use trigger price as estimate
      if (!currentPrice || currentPrice === 0) {
        currentPrice = triggerPrice;
        console.log(`[Jupiter Trigger] Using trigger price as fallback current price: ${currentPrice}`);
      }
      
      console.log(`[Jupiter Trigger] Enriched order: ${tokenSymbol} (${tokenName}) - ${isBuy ? 'BUY' : 'SELL'} ${displayAmount.toFixed(6)} @ $${triggerPrice.toFixed(8)} | Current: $${currentPrice || 'N/A'}`);
      
      // Extract transaction signatures from various possible locations in Jupiter API response
      // Jupiter may store signatures in different fields depending on order status and version
      const createTxSignature = 
        order.createTxSignature || 
        account.createTxSignature || 
        order.createTx || 
        account.createTx ||
        order.signature || 
        account.signature ||
        null;
        
      const updateTxSignature = 
        order.updateTxSignature || 
        account.updateTxSignature || 
        order.updateTx || 
        account.updateTx ||
        null;
        
      const cancelTxSignature = 
        order.cancelTxSignature || 
        account.cancelTxSignature || 
        order.cancelTx || 
        account.cancelTx ||
        null;
        
      const executeTxSignature = 
        order.executeTxSignature || 
        account.executeTxSignature || 
        order.executeTx || 
        account.executeTx ||
        order.executedTxSignature ||
        account.executedTxSignature ||
        null;
      
      // Log extracted signatures for debugging (only show if present)
      const signaturesFound = {
        create: createTxSignature ? `${createTxSignature.slice(0, 8)}...` : 'none',
        update: updateTxSignature ? `${updateTxSignature.slice(0, 8)}...` : 'none',
        cancel: cancelTxSignature ? `${cancelTxSignature.slice(0, 8)}...` : 'none',
        execute: executeTxSignature ? `${executeTxSignature.slice(0, 8)}...` : 'none'
      };
      
      if (createTxSignature || updateTxSignature || cancelTxSignature || executeTxSignature) {
        console.log(`[Jupiter Trigger] Transaction signatures found:`, signaturesFound);
      }
      
      return {
        id: orderId,
        orderId: orderId,
        tokenSymbol,
        tokenName,
        tokenMint,
        type: isBuy ? 'buy' : 'sell',
        status: orderStatus === 'active' ? 'active' : order.status || 'executed',
        triggerPrice: triggerPrice,
        amount: displayAmount,
        currentPrice: currentPrice, // Now populated from Jupiter Price API
        estimatedValue: estimatedValue,
        createdAt: createdAtISO,
        expiresAt: expiredAtISO,
        executedAt: order.executedAt || null,
        inputMint,
        outputMint,
        makingAmount,
        takingAmount,
        maker: account.maker || order.maker || wallet,
        // Include decimals for frontend calculations
        inputDecimals: isBuy ? 9 : tokenDecimals,
        outputDecimals: isBuy ? tokenDecimals : 9,
        tokenDecimals,
        // Transaction signatures for Solscan links
        createTxSignature,
        updateTxSignature,
        cancelTxSignature,
        executeTxSignature,
        // Raw order data for debugging
        rawOrder: order
      };
    }));
    
    return {
      success: true,
      user: response.data.user,
      orderStatus: response.data.orderStatus,
      orders: enrichedOrders,
      totalPages: response.data.totalPages || 1,
      page: response.data.page || page
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error fetching orders:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      orders: [],
      totalPages: 0,
      page: 0
    };
  }
}

/**
 * Calculate trigger price based on percentage
 * @param {number} currentPrice - Current token price
 * @param {number} percentage - Percentage change (e.g., 10 for +10%, -5 for -5%)
 * @returns {number} Calculated trigger price
 */
function calculateTriggerPrice(currentPrice, percentage) {
  return currentPrice * (1 + percentage / 100);
}

/**
 * Calculate making/taking amounts for limit orders
 * @param {Object} params - Calculation parameters
 * @returns {Object} Calculated amounts in smallest units (lamports/decimals)
 */
function calculateOrderAmounts({ 
  inputAmount, 
  inputDecimals, 
  outputAmount, 
  outputDecimals,
  limitPrice,
  side = 'buy' // 'buy' or 'sell'
}) {
  // Convert to smallest units
  const makingAmount = Math.floor(inputAmount * Math.pow(10, inputDecimals));
  
  let takingAmount;
  if (outputAmount) {
    takingAmount = Math.floor(outputAmount * Math.pow(10, outputDecimals));
  } else if (limitPrice) {
    // Calculate based on limit price
    if (side === 'buy') {
      takingAmount = Math.floor((inputAmount / limitPrice) * Math.pow(10, outputDecimals));
    } else {
      takingAmount = Math.floor((inputAmount * limitPrice) * Math.pow(10, outputDecimals));
    }
  }

  return {
    makingAmount: makingAmount.toString(),
    takingAmount: takingAmount.toString()
  };
}

/**
 * Get order status
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order details
 */
async function getOrderStatus(orderId) {
  try {
    console.log(`[Jupiter Trigger] Fetching status for order ${orderId}`);

    const response = await axios.get(
      `${JUPITER_TRIGGER_API}/order/${orderId}`,
      { timeout: 30000 }
    );

    return {
      success: true,
      order: response.data
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error fetching order status:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Validate order parameters before submission
 * @param {Object} params - Order parameters to validate
 * @returns {Object} Validation result
 */
function validateOrderParams(params) {
  const errors = [];

  if (!params.maker) errors.push('Missing maker address');
  if (!params.inputMint) errors.push('Missing input mint address');
  if (!params.outputMint) errors.push('Missing output mint address');
  if (!params.makingAmount) errors.push('Missing making amount');
  if (!params.takingAmount) errors.push('Missing taking amount');

  // Validate amounts are positive numbers
  if (params.makingAmount && parseFloat(params.makingAmount) <= 0) {
    errors.push('Making amount must be positive');
  }
  if (params.takingAmount && parseFloat(params.takingAmount) <= 0) {
    errors.push('Taking amount must be positive');
  }

  // Validate expiration if provided
  if (params.expiredAt) {
    const now = Math.floor(Date.now() / 1000);
    if (params.expiredAt <= now) {
      errors.push('Expiration time must be in the future');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  createOrder,
  executeOrder,
  cancelOrder,
  cancelOrders,
  getTriggerOrders,
  calculateTriggerPrice,
  calculateOrderAmounts,
  getOrderStatus,
  validateOrderParams,
  // Export configuration for testing/debugging
  config: {
    apiUrl: JUPITER_TRIGGER_API,
    referralAccount: REFERRAL_ACCOUNT,
    feeBps: FEE_BPS
  }
};
