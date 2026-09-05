/**
 * Lightweight password hashing (scrypt) — no external deps needed.
 * Stored format: "<saltHex>:<hashHex>"
 */
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const testBuf = crypto.scryptSync(String(password), salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, testBuf);
}

// Human-typable random password (letters+digits only)
function generatePassword(len = 10) {
  const raw = crypto.randomBytes(len * 2).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, len) || generatePassword(len); // retry on unlucky all-symbol draw
}

module.exports = { hashPassword, verifyPassword, generatePassword };
