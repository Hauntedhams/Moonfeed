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

module.exports = router;
