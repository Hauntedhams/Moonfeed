const express = require('express');
const router = express.Router();
const DeviceToken = require('../models/DeviceToken');

// POST /api/push/register — upsert a device's FCM token (called on every app launch).
// Body: { token, walletAddress?, platform?, prefs? }
router.post('/register', async (req, res) => {
  try {
    const { token, walletAddress = null, platform = 'ios', prefs } = req.body || {};
    if (!token || typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const update = {
      walletAddress: walletAddress || null,
      platform: ['ios', 'android', 'web'].includes(platform) ? platform : 'ios',
      lastSeenAt: new Date(),
    };
    if (prefs && typeof prefs === 'object') {
      for (const k of ['trackedGain', 'holdingCrash', 'walletTrade', 'orderFill']) {
        if (typeof prefs[k] === 'boolean') update[`prefs.${k}`] = prefs[k];
      }
    }

    await DeviceToken.findOneAndUpdate(
      { token },
      { $set: update, $setOnInsert: { token } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ push register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/push/unregister — remove a token (logout / notifications disabled).
router.post('/unregister', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing token' });
    await DeviceToken.deleteOne({ token });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ push unregister error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
