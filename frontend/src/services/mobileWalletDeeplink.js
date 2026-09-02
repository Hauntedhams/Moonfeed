// Phantom / Solflare encrypted deeplink wallet for the native Capacitor app.
//
// Inside the Android WebView, browser-extension adapters and the Mobile Wallet
// Adapter handshake don't work. Instead we use the wallets' documented
// universal-link deeplink protocol: we open the wallet app with an encrypted
// request, the user approves, and the wallet redirects back into Moonfeed via
// our `moonfeed://` scheme with an encrypted response.
//
// Docs: https://docs.phantom.app/phantom-deeplinks/provider-methods
//       https://docs.solflare.com/solflare/technical/deeplinks

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { App } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';

const APP_URL = 'https://moonfeed.app';
const SCHEME = 'moonfeed';
const STORAGE_KEY = 'moonfeed.mobileWallet.session';

const PROVIDERS = {
  phantom: {
    base: 'https://phantom.app/ul/v1',
    encryptionPublicKeyParam: 'phantom_encryption_public_key',
  },
  solflare: {
    base: 'https://solflare.com/ul/v1',
    encryptionPublicKeyParam: 'solflare_encryption_public_key',
  },
};

// ---------------------------------------------------------------------------
// Byte helpers (browser-safe base64 <-> Uint8Array)
// ---------------------------------------------------------------------------
const base64ToBytes = (b64) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToBase64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

class MobileWalletDeeplink {
  constructor() {
    this.provider = null;            // 'phantom' | 'solflare'
    this.dappKeyPair = null;         // nacl.box keyPair (x25519)
    this.sharedSecret = null;        // Uint8Array
    this.session = null;             // opaque wallet session token
    this.publicKey = null;           // base58 Solana address
    this.pending = null;             // { action, resolve, reject, wentBackground }
    this.listenerReady = false;
    this._resumeTimer = null;

    this._restore();
  }

  isConnected() {
    return Boolean(this.publicKey && this.session && this.sharedSecret);
  }

  getProviderConfig() {
    return PROVIDERS[this.provider];
  }

  // -------------------------------------------------------------------------
  // Persistence — survives the app being backgrounded during the round-trip
  // and cold starts so the session can be reused.
  // -------------------------------------------------------------------------
  _persist() {
    try {
      if (!this.isConnected()) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: this.provider,
          dappSecretKey: bs58.encode(this.dappKeyPair.secretKey),
          sharedSecret: bs58.encode(this.sharedSecret),
          session: this.session,
          publicKey: this.publicKey,
        })
      );
    } catch (e) {
      console.warn('[mobileWallet] persist failed', e);
    }
  }

  _restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.provider = s.provider;
      this.dappKeyPair = nacl.box.keyPair.fromSecretKey(bs58.decode(s.dappSecretKey));
      this.sharedSecret = bs58.decode(s.sharedSecret);
      this.session = s.session;
      this.publicKey = s.publicKey;
    } catch (e) {
      console.warn('[mobileWallet] restore failed', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // -------------------------------------------------------------------------
  // Redirect listener — registered once. The wallet reopens Moonfeed via
  // moonfeed://wallet/<action>?...; we parse and resolve the pending request.
  // -------------------------------------------------------------------------
  async ensureListener() {
    if (this.listenerReady) return;
    this.listenerReady = true;
    await App.addListener('appUrlOpen', ({ url }) => {
      try {
        this._handleRedirect(url);
      } catch (err) {
        this._rejectPending(err);
      }
    });
    // Watchdog: if the wallet app errors internally (e.g. Phantom's "Unknown
    // Error" screen) it never redirects back — without this, the pending
    // promise (and the UI spinner) would hang forever.
    await App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        if (this.pending) this.pending.wentBackground = true;
        this._clearResumeTimer();
        return;
      }
      if (this.pending && this.pending.wentBackground) {
        this._clearResumeTimer();
        this._resumeTimer = setTimeout(() => {
          this._rejectPending(new Error(
            'The wallet closed without completing the request — it may have hit an error. Please try again.'
          ));
        }, 3500);
      }
    });
  }

  _clearResumeTimer() {
    if (this._resumeTimer) {
      clearTimeout(this._resumeTimer);
      this._resumeTimer = null;
    }
  }

  _handleRedirect(url) {
    if (!url || !url.startsWith(`${SCHEME}://`)) return;
    const parsed = new URL(url);
    const action = parsed.pathname.replace(/^\/+/, '') || parsed.host;
    const params = parsed.searchParams;

    if (params.get('errorCode')) {
      this._rejectPending(
        new Error(params.get('errorMessage') || `Wallet error ${params.get('errorCode')}`)
      );
      return;
    }

    if (action === 'connect') {
      this._completeConnect(params);
    } else {
      this._completeSignedResponse(action, params);
    }
  }

  _completeConnect(params) {
    const cfg = this.getProviderConfig();
    const walletEncPubKey = params.get(cfg.encryptionPublicKeyParam);
    const data = params.get('data');
    const nonce = params.get('nonce');
    if (!walletEncPubKey || !data || !nonce) {
      this._rejectPending(new Error('Incomplete connect response from wallet'));
      return;
    }
    this.sharedSecret = nacl.box.before(bs58.decode(walletEncPubKey), this.dappKeyPair.secretKey);
    const payload = this._decrypt(data, nonce);
    this.session = payload.session;
    this.publicKey = payload.public_key;
    this._persist();
    this._resolvePending({ publicKey: this.publicKey });
  }

  _completeSignedResponse(action, params) {
    const data = params.get('data');
    const nonce = params.get('nonce');
    if (!data || !nonce) {
      this._rejectPending(new Error('Incomplete response from wallet'));
      return;
    }
    const payload = this._decrypt(data, nonce);
    this._resolvePending(payload);
  }

  // -------------------------------------------------------------------------
  // Encryption
  // -------------------------------------------------------------------------
  _decrypt(dataB58, nonceB58) {
    const decrypted = nacl.box.open.after(
      bs58.decode(dataB58),
      bs58.decode(nonceB58),
      this.sharedSecret
    );
    if (!decrypted) throw new Error('Failed to decrypt wallet response');
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  _encrypt(payload) {
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
      new TextEncoder().encode(JSON.stringify(payload)),
      nonce,
      this.sharedSecret
    );
    return { nonce: bs58.encode(nonce), payload: bs58.encode(encrypted) };
  }

  // -------------------------------------------------------------------------
  // Pending request plumbing (one deeplink round-trip at a time)
  // -------------------------------------------------------------------------
  _resolvePending(value) {
    this._clearResumeTimer();
    const p = this.pending;
    this.pending = null;
    if (p) p.resolve(value);
  }

  _rejectPending(err) {
    this._clearResumeTimer();
    const p = this.pending;
    this.pending = null;
    if (p) p.reject(err);
  }

  _redirectLink(action) {
    return `${SCHEME}://wallet/${action}`;
  }

  async _open(url, action) {
    await this.ensureListener();
    return new Promise((resolve, reject) => {
      if (this.pending) {
        this.pending.reject(new Error('Cancelled by a newer wallet request'));
      }
      this._clearResumeTimer();
      this.pending = { action, resolve, reject, wentBackground: false };
      AppLauncher.openUrl({ url }).catch((err) => {
        this._rejectPending(new Error(`Could not open wallet app: ${err.message || err}`));
      });
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  async connect(provider) {
    if (!PROVIDERS[provider]) throw new Error(`Unsupported wallet: ${provider}`);
    this.provider = provider;
    this.dappKeyPair = nacl.box.keyPair();
    this.session = null;
    this.publicKey = null;
    this.sharedSecret = null;

    const cfg = this.getProviderConfig();
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(this.dappKeyPair.publicKey),
      cluster: 'mainnet-beta',
      app_url: APP_URL,
      redirect_link: this._redirectLink('connect'),
    });
    const url = `${cfg.base}/connect?${params.toString()}`;
    const result = await this._open(url, 'connect');
    return result.publicKey;
  }

  async disconnect() {
    if (!this.isConnected()) {
      this._clear();
      return;
    }
    try {
      const cfg = this.getProviderConfig();
      const { nonce, payload } = this._encrypt({ session: this.session });
      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(this.dappKeyPair.publicKey),
        nonce,
        redirect_link: this._redirectLink('disconnect'),
        payload,
      });
      // Fire-and-forget; we clear local state regardless of the round-trip.
      AppLauncher.openUrl({ url: `${cfg.base}/disconnect?${params.toString()}` }).catch(() => {});
    } finally {
      this._clear();
    }
  }

  _clear() {
    this.provider = null;
    this.dappKeyPair = null;
    this.sharedSecret = null;
    this.session = null;
    this.publicKey = null;
    this._persist();
  }

  // transactionBytes: Uint8Array of a serialized (unsigned) transaction.
  // Returns the on-chain signature string.
  async signAndSendSerialized(transactionBytes) {
    this._assertConnected();
    const cfg = this.getProviderConfig();
    const { nonce, payload } = this._encrypt({
      session: this.session,
      transaction: bs58.encode(transactionBytes),
    });
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(this.dappKeyPair.publicKey),
      nonce,
      redirect_link: this._redirectLink('signAndSend'),
      payload,
    });
    const result = await this._open(
      `${cfg.base}/signAndSendTransaction?${params.toString()}`,
      'signAndSend'
    );
    return result.signature;
  }

  // Returns the signed transaction as a Uint8Array.
  async signSerialized(transactionBytes) {
    this._assertConnected();
    const cfg = this.getProviderConfig();
    const { nonce, payload } = this._encrypt({
      session: this.session,
      transaction: bs58.encode(transactionBytes),
    });
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(this.dappKeyPair.publicKey),
      nonce,
      redirect_link: this._redirectLink('signTransaction'),
      payload,
    });
    const result = await this._open(
      `${cfg.base}/signTransaction?${params.toString()}`,
      'signTransaction'
    );
    return bs58.decode(result.transaction);
  }

  // Returns an array of signed transactions as Uint8Array[].
  async signAllSerialized(transactionsBytes) {
    this._assertConnected();
    const cfg = this.getProviderConfig();
    const { nonce, payload } = this._encrypt({
      session: this.session,
      transactions: transactionsBytes.map((b) => bs58.encode(b)),
    });
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(this.dappKeyPair.publicKey),
      nonce,
      redirect_link: this._redirectLink('signAllTransactions'),
      payload,
    });
    const result = await this._open(
      `${cfg.base}/signAllTransactions?${params.toString()}`,
      'signAllTransactions'
    );
    return result.transactions.map((t) => bs58.decode(t));
  }

  // messageBytes: Uint8Array of the raw message. Returns the 64-byte ed25519
  // signature as a Uint8Array. Both Phantom and Solflare support this deeplink,
  // and unlike transactions the wallet cannot modify a message before signing —
  // which is why Jupiter Trigger V2 auth must use this instead of the
  // transaction challenge whenever possible.
  async signMessage(messageBytes) {
    this._assertConnected();
    const cfg = this.getProviderConfig();
    const { nonce, payload } = this._encrypt({
      session: this.session,
      message: bs58.encode(messageBytes),
      display: 'utf8',
    });
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(this.dappKeyPair.publicKey),
      nonce,
      redirect_link: this._redirectLink('signMessage'),
      payload,
    });
    const result = await this._open(`${cfg.base}/signMessage?${params.toString()}`, 'signMessage');
    return bs58.decode(result.signature);
  }

  _assertConnected() {
    if (!this.isConnected()) throw new Error('Wallet not connected');
  }

  // Convenience wrappers for the app's base64-based signing interface.
  async signTransactionBase64(base64) {
    const signed = await this.signSerialized(base64ToBytes(base64));
    return bytesToBase64(signed);
  }

  async signAndSendTransactionBase64(base64) {
    return this.signAndSendSerialized(base64ToBytes(base64));
  }
}

// Singleton — one wallet session per app instance.
export const mobileWallet = new MobileWalletDeeplink();
export { base64ToBytes, bytesToBase64 };
