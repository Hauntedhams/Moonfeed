/**
 * Jupiter Trigger API Service
 * Handles limit orders and trigger orders for Jupiter DEX
 */

const JUPITER_TRIGGER_API = 'https://api.jup.ag/trigger/v1';

class JupiterTriggerService {
  constructor() {
    this.apiUrl = JUPITER_TRIGGER_API;
  }

  /**
   * Create a trigger order
   * @param {Object} params - Order parameters
   * @returns {Promise<Object>} - Unsigned transaction
   */
  async createOrder(params) {
    try {
      const {
        maker,           // Wallet address (string)
        inputMint,       // Input token mint (string)
        outputMint,      // Output token mint (string)
        makingAmount,    // Input amount in smallest unit (string)
        takingAmount,    // Minimum output amount (string)
        expiredAt,       // Unix timestamp (optional)
        triggerPrice,    // Trigger price (optional)
        orderType        // 'limit' or 'stop' (default: 'limit')
      } = params;

      console.log('🎯 Creating Jupiter trigger order:', {
        maker,
        inputMint: inputMint.slice(0, 8) + '...',
        outputMint: outputMint.slice(0, 8) + '...',
        makingAmount,
        takingAmount,
        orderType: orderType || 'limit'
      });

      const response = await fetch(`${this.apiUrl}/createOrder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maker,
          inputMint,
          outputMint,
          makingAmount,
          takingAmount,
          expiredAt,
          orderType: orderType || 'limit',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jupiter Trigger API error: ${error}`);
      }

      const data = await response.json();
      console.log('✅ Order transaction created');
      
      return {
        success: true,
        transaction: data.tx, // Base64 encoded unsigned transaction
        orderParams: params
      };
    } catch (error) {
      console.error('❌ Error creating trigger order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a signed transaction
   * @param {string} signedTransaction - Base64 encoded signed transaction
   * @returns {Promise<Object>} - Execution result
   */
  async executeOrder(signedTransaction) {
    try {
      console.log('🚀 Executing trigger order...');

      const response = await fetch(`${this.apiUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx: signedTransaction
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Execute error: ${error}`);
      }

      const data = await response.json();
      console.log('✅ Order executed:', data.orderId);
      
      return {
        success: true,
        orderId: data.orderId,
        signature: data.signature
      };
    } catch (error) {
      console.error('❌ Error executing order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a specific order
   * @param {Object} params - Cancellation parameters
   * @returns {Promise<Object>} - Unsigned cancellation transaction
   */
  async cancelOrder({ maker, orderId }) {
    try {
      console.log('🗑️ Canceling order:', orderId);

      const response = await fetch(`${this.apiUrl}/cancelOrder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maker,
          orderId
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cancel error: ${error}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transaction: data.tx
      };
    } catch (error) {
      console.error('❌ Error canceling order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel multiple orders
   * @param {Object} params - Cancellation parameters
   * @returns {Promise<Object>} - Unsigned cancellation transactions
   */
  async cancelOrders({ maker, orderIds }) {
    try {
      console.log('🗑️ Canceling multiple orders:', orderIds.length);

      const response = await fetch(`${this.apiUrl}/cancelOrders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maker,
          orderIds
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cancel orders error: ${error}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactions: data.txs // Array of base64 encoded transactions
      };
    } catch (error) {
      console.error('❌ Error canceling orders:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get trigger orders for a wallet
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - List of orders
   */
  async getTriggerOrders({ wallet, status = 'active', page = 1, limit = 20 }) {
    try {
      console.log('📋 Fetching trigger orders for:', wallet.slice(0, 8) + '...');

      const queryParams = new URLSearchParams({
        wallet,
        status, // 'active' or 'history'
        page: page.toString(),
        limit: limit.toString()
      });

      const response = await fetch(`${this.apiUrl}/getTriggerOrders?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Get orders error: ${error}`);
      }

      const data = await response.json();
      console.log(`✅ Found ${data.orders?.length || 0} orders`);
      
      return {
        success: true,
        orders: data.orders || [],
        total: data.total || 0,
        page: data.page || 1,
        hasMore: data.hasMore || false
      };
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      return {
        success: false,
        error: error.message,
        orders: []
      };
    }
  }

  /**
   * Calculate trigger price based on current price and percentage
   * @param {number} currentPrice - Current token price
   * @param {number} percentage - Percentage difference (positive for higher, negative for lower)
   * @returns {number} - Trigger price
   */
  calculateTriggerPrice(currentPrice, percentage) {
    return currentPrice * (1 + percentage / 100);
  }

  /**
   * Convert token amount to smallest unit (lamports/decimals)
   * @param {number} amount - Human readable amount
   * @param {number} decimals - Token decimals
   * @returns {string} - Amount in smallest unit
   */
  toSmallestUnit(amount, decimals = 9) {
    return (amount * Math.pow(10, decimals)).toFixed(0);
  }

  /**
   * Convert from smallest unit to human readable
   * @param {string} amount - Amount in smallest unit
   * @param {number} decimals - Token decimals
   * @returns {number} - Human readable amount
   */
  fromSmallestUnit(amount, decimals = 9) {
    return parseFloat(amount) / Math.pow(10, decimals);
  }
}

module.exports = new JupiterTriggerService();
