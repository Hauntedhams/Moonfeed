/**
 * Jupiter Trigger API Routes
 * RESTful endpoints for limit orders and trigger orders
 */

const express = require('express');
const router = express.Router();
const jupiterTriggerService = require('../services/jupiterTriggerService');

/**
 * POST /api/trigger/create-order
 * Create a new trigger order (limit/stop order)
 */
router.post('/create-order', async (req, res) => {
  try {
    const {
      maker,
      payer, // Add payer support
      inputMint,
      outputMint,
      makingAmount,
      takingAmount,
      expiredAt,
      orderType
    } = req.body;

    // Validate required fields
    if (!maker || !inputMint || !outputMint || !makingAmount || !takingAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: maker, inputMint, outputMint, makingAmount, takingAmount'
      });
    }

    const result = await jupiterTriggerService.createOrder({
      maker,
      payer: payer || maker, // Use payer if provided, otherwise use maker
      inputMint,
      outputMint,
      makingAmount,
      takingAmount,
      expiredAt,
      orderType
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in create-order endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trigger/execute
 * Execute a signed transaction
 */
router.post('/execute', async (req, res) => {
  try {
    const { signedTransaction, requestId } = req.body;

    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        error: 'Missing signedTransaction'
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'Missing requestId'
      });
    }

    const result = await jupiterTriggerService.executeOrder(signedTransaction, requestId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in execute endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trigger/cancel-order
 * Cancel a specific order
 */
router.post('/cancel-order', async (req, res) => {
  try {
    const { maker, orderId } = req.body;

    if (!maker || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: maker, orderId'
      });
    }

    const result = await jupiterTriggerService.cancelOrder({ maker, orderId });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in cancel-order endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trigger/cancel-orders
 * Cancel multiple orders
 */
router.post('/cancel-orders', async (req, res) => {
  try {
    const { maker, orderIds } = req.body;

    if (!maker || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: maker, orderIds (array)'
      });
    }

    const result = await jupiterTriggerService.cancelOrders({ maker, orderIds });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in cancel-orders endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/trigger/orders
 * Get trigger orders for a wallet
 */
router.get('/orders', async (req, res) => {
  try {
    const { wallet, status = 'active', page = 1, limit = 20 } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: wallet'
      });
    }

    const result = await jupiterTriggerService.getTriggerOrders({
      wallet,
      orderStatus: status, // Map 'status' query param to 'orderStatus' for the service
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(result);
  } catch (error) {
    console.error('Error in get orders endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trigger/calculate-price
 * Helper endpoint to calculate trigger prices
 */
router.post('/calculate-price', async (req, res) => {
  try {
    const { currentPrice, percentage } = req.body;

    if (currentPrice === undefined || percentage === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: currentPrice, percentage'
      });
    }

    const triggerPrice = jupiterTriggerService.calculateTriggerPrice(
      parseFloat(currentPrice),
      parseFloat(percentage)
    );

    res.json({
      success: true,
      currentPrice: parseFloat(currentPrice),
      percentage: parseFloat(percentage),
      triggerPrice
    });
  } catch (error) {
    console.error('Error in calculate-price endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
