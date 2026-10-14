// At-rest encryption for opt-in cloud-executed trading wallets.
//
// Provider: AES-256-GCM with a 32-byte master key from CLOUD_EXEC_MASTER_KEY
// (base64). Each record gets a fresh random IV, and the wallet's public key
// is bound in as AAD so a ciphertext can't be re-attached to another wallet
// row. The interface is deliberately tiny (encrypt/decrypt/isConfigured) so
// it can be swapped for AWS KMS / GCP KMS envelope encryption without
// touching callers — only this file and the key material change.
//
// Generate a key:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_VERSION = 1;

let masterKey = null;
function loadMasterKey() {
  if (masterKey) return masterKey;
  const raw = process.env.CLOUD_EXEC_MASTER_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    console.error('[key-vault] CLOUD_EXEC_MASTER_KEY must decode to exactly 32 bytes — cloud execution disabled');
    return null;
  }
  masterKey = buf;
  return masterKey;
}

function isConfigured() {
  return Boolean(loadMasterKey());
}

/**
 * @param {Uint8Array|Buffer} plaintext  secret bytes (64-byte ed25519 secret key)
 * @param {string} aad                   wallet public key (base58)
 * @returns {{ ciphertext: string, iv: string, authTag: string, keyVersion: number }}  base64 fields
 */
function encrypt(plaintext, aad) {
  const key = loadMasterKey();
  if (!key) throw new Error('Key vault not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: KEY_VERSION,
  };
}

/**
 * @param {{ ciphertext: string, iv: string, authTag: string }} record
 * @param {string} aad  wallet public key the record was encrypted for
 * @returns {Buffer} plaintext secret bytes — zero it (fill(0)) when done
 */
function decrypt(record, aad) {
  const key = loadMasterKey();
  if (!key) throw new Error('Key vault not configured');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(record.iv, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]);
}

module.exports = { isConfigured, encrypt, decrypt, KEY_VERSION };
