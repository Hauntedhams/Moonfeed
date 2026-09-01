/**
 * Jupiter Trigger API Routes
 * RESTful endpoints for limit orders and trigger orders
 */

const express = require('express');
const router = express.Router();
const jupiterTriggerService = require('../services/jupiterTriggerService');
const jupiterTriggerV2Service = require('../services/jupiterTriggerV2Service');

// ═══════════════════════════════════════════════════════════════════════════
// Trigger V2 (api.jup.ag/trigger/v2) — supports stop-loss/sell-below, OCO.
// The frontend holds a wallet-scoped JWT (passed via Authorization header);
// this backend attaches the JUPITER_API_KEY. All V1 routes below remain for
// legacy orders created before the migration.
// ═══════════════════════════════════════════════════════════════════════════

const getJwt = (req) => {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
};

const sendV2 = (res, result) => {
  if (result.success) return res.json(result);
  return res.status(result.statusCode >= 400 && result.statusCode < 600 ? result.statusCode : 500).json(result);
};

router.post('/v2/auth/challenge', async (req, res) => {
  try {
    const { walletPubkey, type } = req.body;
    if (!walletPubkey) return res.status(400).json({ success: false, error: 'Missing walletPubkey' });
    sendV2(res, await jupiterTriggerV2Service.authChallenge({ walletPubkey, type }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.post('/v2/auth/verify', async (req, res) => {
  try {
    sendV2(res, await jupiterTriggerV2Service.authVerify(req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.get('/v2/vault', async (req, res) => {
  try {
    const jwt = getJwt(req);
    if (!jwt) return res.status(401).json({ success: false, error: 'Missing Authorization token' });
    sendV2(res, await jupiterTriggerV2Service.getOrRegisterVault(jwt));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.post('/v2/deposit', async (req, res) => {
  try {
    const jwt = getJwt(req);
    if (!jwt) return res.status(401).json({ success: false, error: 'Missing Authorization token' });
    sendV2(res, await jupiterTriggerV2Service.craftDeposit(jwt, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.post('/v2/order', async (req, res) => {
  try {
    const jwt = getJwt(req);
    if (!jwt) return res.status(401).json({ success: false, error: 'Missing Authorization token' });
    sendV2(res, await jupiterTriggerV2Service.createPriceOrder(jwt, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.get('/v2/orders', async (req, res) => {
  try {
    const jwt = getJwt(req);
    if (!jwt) return res.status(401).json({ success: false, error: 'Missing Authorization token' });
    const { state = 'active', limit = 50, offset = 0 } = req.query;
    sendV2(res, await jupiterTriggerV2Service.getOrders(jwt, {
      state,
      limit: parseInt(limit),
      offset: parseInt(offset),
    }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.post('/v2/cancel/:orderId', async (req, res) => {
  try {
    const jwt = getJwt(req);
    if (!jwt) return res.status(401).json({ success: false, error: 'Missing Authorization token' });
    sendV2(res, await jupiterTriggerV2Service.cancelOrderInit(jwt, req.params.orderId));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.post('/v2/confirm-cancel/:orderId', async (req, res) => {
  try {
    const jwt = getJwt(req);
    if (!jwt) return res.status(401).json({ success: false, error: 'Missing Authorization token' });
    const { signedTransaction, cancelRequestId } = req.body;
    if (!signedTransaction || !cancelRequestId) {
      return res.status(400).json({ success: false, error: 'Missing signedTransaction or cancelRequestId' });
    }
    sendV2(res, await jupiterTriggerV2Service.cancelOrderConfirm(jwt, req.params.orderId, { signedTransaction, cancelRequestId }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

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
    const { signedTransaction, requestId, orderMetadata } = req.body;

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
      // Include order metadata in response for localStorage storage
      res.json({
        ...result,
        orderMetadata: orderMetadata || null
      });
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
