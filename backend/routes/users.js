const express = require('express');
const router = express.Router();
const nacl = require('tweetnacl');
const { PublicKey } = require('@solana/web3.js');
const User = require('../models/User');

// GET /api/users/:walletAddress — fetch profile (public, no auth needed)
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = await User.findOne({ walletAddress });

    if (!user) {
      // Return empty profile — wallet hasn't set one up yet
      return res.json({ walletAddress, displayName: '', bio: '', profilePicture: null });
    }

    res.json({
      walletAddress: user.walletAddress,
      displayName: user.displayName || '',
      bio: user.bio || '',
      profilePicture: user.profilePicture || null
    });
  } catch (err) {
    console.error('❌ Error fetching user profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:walletAddress — update profile (requires wallet signature)
router.put('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { displayName, bio, profilePicture, signature } = req.body;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Verify ownership via wallet signature
    if (!signature) {
      return res.status(401).json({ error: 'Signature required' });
    }

    try {
      const message = Buffer.from('Moonfeed profile update');
      const signatureBytes = Buffer.from(signature, 'base64');
      const publicKeyBytes = new PublicKey(walletAddress).toBytes();
      const valid = nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (e) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Validate field lengths
    if (displayName !== undefined && displayName.length > 32) {
      return res.status(400).json({ error: 'Display name must be 32 characters or less' });
    }
    if (bio !== undefined && bio.length > 160) {
      return res.status(400).json({ error: 'Bio must be 160 characters or less' });
    }

    // Validate profile picture format and size
    if (profilePicture) {
      if (!profilePicture.startsWith('data:image/') && !profilePicture.startsWith('http')) {
        return res.status(400).json({ error: 'Profile picture must be a data URL or http URL' });
      }
      // ~500KB max image stored in DB
      if (profilePicture.length > 700000) {
        return res.status(400).json({ error: 'Profile picture too large (max ~500KB)' });
      }
    }

    const update = {};
    if (displayName !== undefined) update.displayName = displayName.trim();
    if (bio !== undefined) update.bio = bio.trim();
    if (profilePicture !== undefined) update.profilePicture = profilePicture || null;

    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({
      walletAddress: user.walletAddress,
      displayName: user.displayName || '',
      bio: user.bio || '',
      profilePicture: user.profilePicture || null
    });
  } catch (err) {
    console.error('❌ Error updating user profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:walletAddress/alerts — fetch saved price-alert preferences
router.get('/:walletAddress/alerts', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const user = await User.findOne({ walletAddress });
    res.json({ walletAddress, alerts: user?.alerts || {} });
  } catch (err) {
    console.error('❌ Error fetching alerts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:walletAddress/alerts — save price-alert preferences.
// Low-risk preference data keyed by wallet; no signature required.
router.put('/:walletAddress/alerts', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { alerts } = req.body;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (alerts === undefined || alerts === null || typeof alerts !== 'object' || Array.isArray(alerts)) {
      return res.status(400).json({ error: 'alerts must be an object' });
    }
    // Guard against oversized payloads (map of at most a few hundred coins).
    if (Object.keys(alerts).length > 500) {
      return res.status(400).json({ error: 'Too many alert entries (max 500)' });
    }

    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: { alerts } },
      { upsert: true, new: true }
    );

    res.json({ walletAddress: user.walletAddress, alerts: user.alerts || {} });
  } catch (err) {
    console.error('❌ Error saving alerts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:walletAddress/referral — stamp first-touch influencer attribution.
// Set once, immutable afterwards (first code wins). No signature: writing a ref code
// for someone else's wallet only ever credits an influencer, never harms the user.
router.post('/:walletAddress/referral', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { code } = req.body;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (!code || typeof code !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    const existing = await User.findOne({ walletAddress }).lean();
    if (existing?.referredBy?.code) {
      return res.json({ walletAddress, referredBy: existing.referredBy, alreadySet: true });
    }

    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: { referredBy: { code, at: new Date() } } },
      { upsert: true, new: true }
    );

    console.log(`🎯 Referral attribution: ${walletAddress.slice(0, 8)}… → ${code}`);
    res.json({ walletAddress: user.walletAddress, referredBy: user.referredBy, alreadySet: false });
  } catch (err) {
    console.error('❌ Error stamping referral:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:walletAddress/tracked-wallets — fetch synced tracked-wallet list
router.get('/:walletAddress/tracked-wallets', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const user = await User.findOne({ walletAddress });
    res.json({ walletAddress, trackedWallets: user?.trackedWallets || [] });
  } catch (err) {
    console.error('❌ Error fetching tracked wallets:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:walletAddress/tracked-wallets — save synced tracked-wallet list.
// Low-risk preference data keyed by wallet; no signature required (same as /alerts).
router.put('/:walletAddress/tracked-wallets', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { trackedWallets } = req.body;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (!Array.isArray(trackedWallets)) {
      return res.status(400).json({ error: 'trackedWallets must be an array' });
    }
    if (trackedWallets.length > 200) {
      return res.status(400).json({ error: 'Too many tracked wallets (max 200)' });
    }

    const sanitized = trackedWallets
      .filter(w => w && typeof w.address === 'string' && w.address.length >= 32)
      .map(w => ({
        address: w.address,
        label: typeof w.label === 'string' ? w.label.slice(0, 64) : '',
        addedAt: Number.isFinite(w.addedAt) ? w.addedAt : Date.now(),
        lastViewed: Number.isFinite(w.lastViewed) ? w.lastViewed : Date.now(),
        copyTradeEnabled: w.copyTradeEnabled !== false
      }));

    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: { trackedWallets: sanitized } },
      { upsert: true, new: true }
    );

    res.json({ walletAddress: user.walletAddress, trackedWallets: user.trackedWallets || [] });
  } catch (err) {
    console.error('❌ Error saving tracked wallets:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:walletAddress/tracked-coins — fetch synced tracked-coins (favorites) list
router.get('/:walletAddress/tracked-coins', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const user = await User.findOne({ walletAddress });
    res.json({ walletAddress, trackedCoins: user?.trackedCoins || [] });
  } catch (err) {
    console.error('❌ Error fetching tracked coins:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:walletAddress/tracked-coins — save synced tracked-coins (favorites) list.
// Low-risk preference data keyed by wallet; no signature required (same as /alerts).
router.put('/:walletAddress/tracked-coins', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { trackedCoins } = req.body;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (!Array.isArray(trackedCoins)) {
      return res.status(400).json({ error: 'trackedCoins must be an array' });
    }
    if (trackedCoins.length > 500) {
      return res.status(400).json({ error: 'Too many tracked coins (max 500)' });
    }

    const sanitized = trackedCoins
      .filter(c => c && typeof c.mintAddress === 'string' && c.mintAddress.length >= 32)
      .map(c => ({
        mintAddress: c.mintAddress,
        symbol: typeof c.symbol === 'string' ? c.symbol.slice(0, 32) : '',
        name: typeof c.name === 'string' ? c.name.slice(0, 64) : '',
        image: typeof c.image === 'string' ? c.image.slice(0, 500) : '',
        addedAt: Number.isFinite(c.addedAt) ? c.addedAt : Date.now(),
        trackedAtPrice: Number.isFinite(c.trackedAtPrice) && c.trackedAtPrice > 0 ? c.trackedAtPrice : 0
      }));

    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: { trackedCoins: sanitized } },
      { upsert: true, new: true }
    );

    res.json({ walletAddress: user.walletAddress, trackedCoins: user.trackedCoins || [] });
  } catch (err) {
    console.error('❌ Error saving tracked coins:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
