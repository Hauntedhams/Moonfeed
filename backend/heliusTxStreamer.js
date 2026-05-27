/**
 * HeliusTxStreamer
 *
 * Maintains ONE persistent Helius logsSubscribe WebSocket per token.
 * Multiple frontend clients can subscribe to the same token — they all
 * share a single upstream Helius connection (cost efficient).
 *
 * Flow:
 *   Frontend WS → backend → Helius logsSubscribe WS (one per token)
 *   Helius emits signature → backend batches + parses via Helius Enhanced API
 *   Parsed swaps → broadcast to all subscribed frontend clients as `tx-new`
 */

const WebSocket = require('ws');
const axios = require('axios');
const solanaTransactionService = require('./solanaTransactionService');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || process.env.HELIUS_KEY || '26240c3d-8cce-414e-95f7-5c0c75c1a2cb';
const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
// Public Solana mainnet RPC WebSocket — fallback when Helius is rate-limited
const PUBLIC_SOLANA_WS_URL = 'wss://api.mainnet-beta.solana.com';
const PUBLIC_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const FLUSH_DEBOUNCE_MS = 500; // Batch signatures for 500ms before parsing
const MAX_BATCH_SIZE = 20;     // Max signatures per Helius Enhanced API call
const PING_INTERVAL_MS = 30_000; // Send ping every 30s to keep Helius WS alive

class HeliusTxStreamer {
  constructor() {
    // mintAddress -> { ws, subscriptionId, clients: Set<ws>, sigQueue: [], flushTimer }
    this.streams = new Map();
  }

  /**
   * Register a frontend WS client for live tx updates on a token.
   * Opens a Helius WS if this is the first subscriber.
   */
  subscribe(mintAddress, clientWs) {
    let stream = this.streams.get(mintAddress);
    if (!stream) {
      stream = {
        ws: null,
        subscriptionId: null,
        clients: new Set(),
        sigQueue: [],
        flushTimer: null,
        pingInterval: null,
      };
      this.streams.set(mintAddress, stream);
      this._openStream(mintAddress, stream);
    }
    stream.clients.add(clientWs);
    console.log(`[TxStreamer] Client subscribed to ${mintAddress.substring(0, 8)}. Total clients: ${stream.clients.size}`);
  }

  /**
   * Remove a frontend WS client from a token's live stream.
   * Closes the Helius WS if no clients remain.
   */
  unsubscribe(mintAddress, clientWs) {
    const stream = this.streams.get(mintAddress);
    if (!stream) return;

    stream.clients.delete(clientWs);
    console.log(`[TxStreamer] Client unsubscribed from ${mintAddress.substring(0, 8)}. Remaining: ${stream.clients.size}`);

    if (stream.clients.size === 0) {
      this._closeStream(mintAddress, stream);
      this.streams.delete(mintAddress);
    }
  }

  /**
   * Remove a client from ALL token streams (called on client disconnect).
   */
  removeClient(clientWs) {
    for (const [mintAddress] of this.streams.entries()) {
      const stream = this.streams.get(mintAddress);
      if (stream && stream.clients.has(clientWs)) {
        this.unsubscribe(mintAddress, clientWs);
      }
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _openStream(mintAddress, stream, usePublicRpc = false) {
    const wsUrl = usePublicRpc ? PUBLIC_SOLANA_WS_URL : HELIUS_WS_URL;
    try {
      const ws = new WebSocket(wsUrl);
      stream.ws = ws;
      stream.usingPublicRpc = usePublicRpc;

      ws.on('open', () => {
        console.log(`[TxStreamer] Helius WS open for ${mintAddress.substring(0, 8)}`);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'logsSubscribe',
          params: [{ mentions: [mintAddress] }, { commitment: 'confirmed' }],
        }));

        // Keepalive ping every 30s to prevent idle disconnect
        if (stream.pingInterval) clearInterval(stream.pingInterval);
        stream.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
        }, PING_INTERVAL_MS);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Subscription confirmation
          if (msg.result && typeof msg.result === 'number') {
            stream.subscriptionId = msg.result;
            return;
          }

          // Log notification — extract signature and queue it
          if (msg.params?.result?.value) {
            const { signature, err } = msg.params.result.value;
            if (err || !signature) return; // Skip failed txs

            stream.sigQueue.push(signature);

            // Debounce: flush after 500ms of inactivity
            if (stream.flushTimer) clearTimeout(stream.flushTimer);
            stream.flushTimer = setTimeout(
              () => this._flushQueue(mintAddress, stream),
              FLUSH_DEBOUNCE_MS
            );
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (e) => {
        console.warn(`[TxStreamer] WS error for ${mintAddress.substring(0, 8)} (${usePublicRpc ? 'public' : 'helius'}):`, e.message);
        // If Helius fails, retry with public Solana RPC
        if (!usePublicRpc) {
          console.log(`[TxStreamer] Helius WS failed, will retry with public Solana RPC for ${mintAddress.substring(0, 8)}`);
          stream.usePublicRpcOnReconnect = true;
        }
      });

      ws.on('close', () => {
        console.log(`[TxStreamer] WS closed for ${mintAddress.substring(0, 8)} (${usePublicRpc ? 'public' : 'helius'})`);
        stream.ws = null;
        if (stream.pingInterval) {
          clearInterval(stream.pingInterval);
          stream.pingInterval = null;
        }

        // Reconnect if clients still subscribed
        if (this.streams.has(mintAddress) && stream.clients.size > 0) {
          const nextPublic = stream.usePublicRpcOnReconnect || usePublicRpc;
          console.log(`[TxStreamer] Reconnecting ${mintAddress.substring(0, 8)} in 3s (${nextPublic ? 'public RPC' : 'helius'})...`);
          setTimeout(() => {
            if (this.streams.has(mintAddress) && stream.clients.size > 0) {
              this._openStream(mintAddress, stream, nextPublic);
            }
          }, 3000);
        }
      });
    } catch (e) {
      console.error(`[TxStreamer] Failed to open Helius WS:`, e.message);
    }
  }

  async _flushQueue(mintAddress, stream) {
    stream.flushTimer = null;
    const sigs = stream.sigQueue.splice(0, MAX_BATCH_SIZE);
    if (!sigs.length || !stream.clients.size) return;

    let swaps = [];

    // Strategy 1: Helius Enhanced API (fast, pre-parsed)
    if (HELIUS_API_KEY && !stream.heliusEnhancedRateLimited) {
      try {
        const response = await axios.post(
          `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
          { transactions: sigs },
          { timeout: 10000 }
        );
        if (Array.isArray(response.data)) {
          swaps = response.data
            .map(tx => solanaTransactionService.extractSwapFromHelius(tx, mintAddress))
            .filter(Boolean);
        }
      } catch (e) {
        console.warn(`[TxStreamer] Helius enhanced API failed (${e.response?.status || e.message}), falling back to public RPC`);
        if (e.response?.status === 429 || e.response?.status === 402) {
          stream.heliusEnhancedRateLimited = true;
        }
      }
    }

    // Strategy 2: Public Solana RPC getTransaction fallback
    if (swaps.length === 0 && sigs.length > 0) {
      try {
        const results = await Promise.allSettled(
          sigs.map(sig =>
            axios.post(PUBLIC_SOLANA_RPC_URL, {
              jsonrpc: '2.0', id: 1,
              method: 'getTransaction',
              params: [sig, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
            }, { timeout: 6000 })
          )
        );
        for (let i = 0; i < results.length; i++) {
          if (results[i].status !== 'fulfilled') continue;
          const tx = results[i].value?.data?.result;
          if (!tx || !tx.meta || tx.meta.err) continue;
          const swap = solanaTransactionService.extractSwapFromRpc(tx, sigs[i], mintAddress);
          if (swap) swaps.push(swap);
        }
      } catch (e) {
        console.warn(`[TxStreamer] Public RPC flush fallback failed:`, e.message);
      }
    }

    if (!swaps.length) return;

    console.log(`[TxStreamer] Broadcasting ${swaps.length} new swaps for ${mintAddress.substring(0, 8)}`);

    const payload = JSON.stringify({
      type: 'tx-new',
      token: mintAddress,
      transactions: swaps,
    });

    for (const clientWs of stream.clients) {
      if (clientWs.readyState === 1 /* OPEN */) {
        clientWs.send(payload, { compress: false });
      }
    }
  }

  _closeStream(mintAddress, stream) {
    if (stream.flushTimer) {
      clearTimeout(stream.flushTimer);
      stream.flushTimer = null;
    }
    if (stream.pingInterval) {
      clearInterval(stream.pingInterval);
      stream.pingInterval = null;
    }
    if (!stream.ws) return;
    try {
      if (stream.subscriptionId !== null && stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'logsUnsubscribe',
          params: [stream.subscriptionId],
        }));
      }
      stream.ws.close();
    } catch (e) {
      // Ignore close errors
    }
    stream.ws = null;
    console.log(`[TxStreamer] Closed Helius WS for ${mintAddress.substring(0, 8)}`);
  }
}

module.exports = new HeliusTxStreamer();
