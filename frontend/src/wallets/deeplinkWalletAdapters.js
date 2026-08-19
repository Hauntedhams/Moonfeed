// Solana wallet-adapter implementations for Phantom and Solflare that connect
// via encrypted deeplinks (see mobileWalletDeeplink.js). Registering these in
// the Jupiter UnifiedWalletProvider makes every existing "Connect Wallet"
// entry point in the app work natively inside the Capacitor WebView — where
// browser extensions and the Mobile Wallet Adapter handshake don't function.

import { BaseSignerWalletAdapter, WalletReadyState } from '@solana/wallet-adapter-base';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { mobileWallet } from '../services/mobileWalletDeeplink';

// NOTE: Jupiter's plugin loads its own copy of @solana/web3.js from a remote
// script, so `instanceof VersionedTransaction` fails for transactions it hands
// us (different class identity). Detect versioned txs by duck-typing on the
// `version` property, and detect the type of returned bytes from the wire
// format (versioned transactions set the high bit on the first byte).
const isVersionedTx = (tx) =>
  tx != null && typeof tx === 'object' && typeof tx.version !== 'undefined';

const serializeTx = (tx) =>
  isVersionedTx(tx)
    ? tx.serialize()
    : tx.serialize({ requireAllSignatures: false, verifySignatures: false });

// Inject the wallet's signed result back into the ORIGINAL transaction object.
// That object belongs to Jupiter's remotely-loaded web3.js, so returning it
// (instead of a copy from our bundled web3.js) keeps Jupiter's internal
// `instanceof VersionedTransaction` checks working.
//
// IMPORTANT: detect versioned vs legacy from the transaction OBJECT, not the
// serialized bytes. Byte 0 of a serialized tx is the signature COUNT — the
// version prefix (0x80) lives on the message, after the signatures — so a
// byte-0 check wrongly classifies versioned txs as legacy.
const applySignatures = (original, signedBytes) => {
  const versioned = isVersionedTx(original);
  if (versioned) {
    const signed = VersionedTransaction.deserialize(signedBytes);
    // Copy the signed message + signatures onto Jupiter's own object so the
    // exact bytes the wallet approved are what gets submitted.
    original.message = signed.message;
    original.signatures = signed.signatures;
  } else {
    const signed = Transaction.from(signedBytes);
    // Preserve Jupiter's PublicKey objects; only copy in the signature bytes.
    signed.signatures.forEach((entry, i) => {
      if (entry.signature && original.signatures[i]) {
        original.signatures[i].signature = entry.signature;
      }
    });
  }
  return original;
};

// Minimal self-contained brand icons (no remote loading).
const PHANTOM_ICON =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#AB9FF2"/><path d="M46 33c0 7.2-5.9 13-13.2 13H18V33a14 14 0 1 1 28 0z" fill="#fff"/><circle cx="27" cy="33" r="3" fill="#AB9FF2"/><circle cx="37" cy="33" r="3" fill="#AB9FF2"/></svg>'
  );

const SOLFLARE_ICON =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#141414"/><circle cx="32" cy="32" r="14" fill="#FC7227"/><circle cx="32" cy="32" r="7" fill="#FFC800"/></svg>'
  );

class DeeplinkWalletAdapter extends BaseSignerWalletAdapter {
  constructor(provider, meta) {
    super();
    this._provider = provider;
    this._name = meta.name;
    this._url = meta.url;
    this._icon = meta.icon;
    this._publicKey = null;
    this._connecting = false;
    // Report Installed (not Loadable) so Jupiter's modal lists these as ready
    // connect options instead of routing to its "download a wallet" onboarding
    // screen. The deeplink launch handles the wallet-not-installed case.
    this._readyState = WalletReadyState.Installed;
    this.supportedTransactionVersions = new Set(['legacy', 0]);

    // Restore an existing session (e.g. after an app restart).
    if (mobileWallet.isConnected() && mobileWallet.provider === provider) {
      try {
        this._publicKey = new PublicKey(mobileWallet.publicKey);
      } catch (_) {
        this._publicKey = null;
      }
    }
  }

  get name() { return this._name; }
  get url() { return this._url; }
  get icon() { return this._icon; }
  get readyState() { return this._readyState; }
  get publicKey() { return this._publicKey; }
  get connecting() { return this._connecting; }

  // Called by wallet-adapter-react on mount when this wallet was previously
  // selected. Only reconnect if a persisted session exists — never launch the
  // wallet app on a cold start.
  async autoConnect() {
    if (mobileWallet.isConnected() && mobileWallet.provider === this._provider) {
      try {
        await this.connect();
      } catch (_) {
        // ignore — user can reconnect manually
      }
    }
  }

  async connect() {
    try {
      if (this.connected || this.connecting) return;
      this._connecting = true;

      let address;
      if (mobileWallet.isConnected() && mobileWallet.provider === this._provider) {
        address = mobileWallet.publicKey;
      } else {
        address = await mobileWallet.connect(this._provider);
      }

      this._publicKey = new PublicKey(address);
      this.emit('connect', this._publicKey);
    } catch (err) {
      this.emit('error', err);
      throw err;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect() {
    try {
      await mobileWallet.disconnect();
    } catch (_) {
      // ignore — we always clear local state
    }
    this._publicKey = null;
    this.emit('disconnect');
  }

  async signTransaction(transaction) {
    const serialized = serializeTx(transaction);
    const signed = await mobileWallet.signSerialized(serialized);
    return applySignatures(transaction, signed);
  }

  async signAllTransactions(transactions) {
    const signed = await mobileWallet.signAllSerialized(transactions.map(serializeTx));
    return transactions.map((tx, i) => applySignatures(tx, signed[i]));
  }

  // Route sending through the wallet's own signAndSend so it broadcasts — one
  // deeplink round-trip instead of sign-then-send-locally.
  async sendTransaction(transaction) {
    return mobileWallet.signAndSendSerialized(serializeTx(transaction));
  }
}

export class PhantomDeeplinkWalletAdapter extends DeeplinkWalletAdapter {
  constructor() {
    super('phantom', { name: 'Phantom', url: 'https://phantom.app', icon: PHANTOM_ICON });
  }
}

export class SolflareDeeplinkWalletAdapter extends DeeplinkWalletAdapter {
  constructor() {
    super('solflare', { name: 'Solflare', url: 'https://solflare.com', icon: SOLFLARE_ICON });
  }
}
