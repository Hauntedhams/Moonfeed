/**
 * HeliusTxStreamer
 *
 * Maintains ONE persistent logsSubscribe WebSocket per token.
 * Uses public Solana RPC as primary — no API key required.
 * Falls back to Helius if configured via HELIUS_API_KEY env var.
 *
 * Flow:
 *   Frontend WS → backend → Public Solana RPC logsSubscribe WS (one per token)
 *   RPC emits signature → backend batches + parses via getTransaction RPC
 *   Parsed swaps → broadcast to all subscribed frontend clients as `tx-new`
 */

const WebSocket = require('ws');
const axios = require('axios');
const solanaTransactionService = require('./solanaTransactionService');
const { HELIUS_WS_URL, HELIUS_RPC_URL, PUBLIC_WS_URL, PUBLIC_RPC_URL } = require('./solanaRpcConfig');

// Helius is primary (public mainnet-beta 429s hard and drops logsSubscribe).
const FLUSH_DEBOUNCE_MS = 250;   // Batch signatures for 250ms of inactivity before parsing
const MAX_WAIT_MS = 600;         // Force a flush at least this often during a continuous burst
const MAX_BATCH_SIZE = 20;     // Max signatures per Helius Enhanced API call
const PING_INTERVAL_MS = 30_000; // Send ping every 30s to keep Helius WS alive

class HeliusTxStreamer {
  constructor() {
    // mintAddress -> { ws, subscriptionId, clients: Set<ws>, sigQueue: [], flushTimer }
    this.streams = new Map();
    this.solPriceGetter = null; // set via setSolPriceGetter() to price each swap in USD
  }

  /** Wire up a function returning the current cached SOL/USD price (no extra API calls). */
  setSolPriceGetter(fn) {
    this.solPriceGetter = fn;
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
        reconnectAttempts: 0,
      };
      this.streams.set(mintAddress, stream);
      this._openStream(mintAddress, stream, false); // primary: Helius RPC
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
    const wsUrl = usePublicRpc ? PUBLIC_WS_URL : (HELIUS_WS_URL || PUBLIC_WS_URL);
    try {
      const ws = new WebSocket(wsUrl);
      stream.ws = ws;
      stream.usingPublicRpc = usePublicRpc;

      ws.on('open', () => {
        console.log(`[TxStreamer] Helius WS open for ${mintAddress.substring(0, 8)}`);
        stream.reconnectAttempts = 0; // reset backoff on a successful connection
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

            // Debounce: flush after a short quiet period, but never let a continuous
            // burst of trades delay the flush past MAX_WAIT_MS.
            if (stream.flushTimer) clearTimeout(stream.flushTimer);
            stream.flushTimer = setTimeout(
              () => this._flushQueue(mintAddress, stream),
              FLUSH_DEBOUNCE_MS
            );
            if (!stream.maxWaitTimer) {
              stream.maxWaitTimer = setTimeout(
                () => this._flushQueue(mintAddress, stream),
                MAX_WAIT_MS
              );
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (e) => {
        console.warn(`[TxStreamer] WS error for ${mintAddress.substring(0, 8)} (${usePublicRpc ? 'public' : 'helius'}):`, e.message);
        // Always reconnect with public RPC
        stream.usePublicRpcOnReconnect = true;
      });

      ws.on('close', () => {
        console.log(`[TxStreamer] WS closed for ${mintAddress.substring(0, 8)} (${usePublicRpc ? 'public' : 'helius'})`);
        stream.ws = null;
        if (stream.pingInterval) {
          clearInterval(stream.pingInterval);
          stream.pingInterval = null;
        }

        // Reconnect if clients still subscribed. Back off exponentially (capped) so a
        // rate-limited (429) Helius connection doesn't get hammered every few seconds.
        if (this.streams.has(mintAddress) && stream.clients.size > 0) {
          const nextPublic = false; // prefer Helius (public RPC 429s)
          const attempt = stream.reconnectAttempts || 0;
          const delay = Math.min(30000, 3000 * Math.pow(2, attempt));
          stream.reconnectAttempts = attempt + 1;
          console.log(`[TxStreamer] Reconnecting ${mintAddress.substring(0, 8)} in ${delay}ms (Helius RPC, attempt ${attempt + 1})...`);
          setTimeout(() => {
            if (this.streams.has(mintAddress) && stream.clients.size > 0) {
              this._openStream(mintAddress, stream, nextPublic);
            }
          }, delay);
        }
      });
    } catch (e) {
      console.error(`[TxStreamer] Failed to open Helius WS:`, e.message);
    }
  }

  async _flushQueue(mintAddress, stream) {
    if (stream.flushTimer) clearTimeout(stream.flushTimer);
    if (stream.maxWaitTimer) clearTimeout(stream.maxWaitTimer);
    stream.flushTimer = null;
    stream.maxWaitTimer = null;
    const sigs = stream.sigQueue.splice(0, MAX_BATCH_SIZE);
    if (!sigs.length || !stream.clients.size) return;

    let swaps = [];

    // Strategy 1: Helius RPC getTransaction (public mainnet-beta 429s)
    if (sigs.length > 0) {
      try {
        const results = await Promise.allSettled(
          sigs.map(sig =>
            axios.post(HELIUS_RPC_URL || PUBLIC_RPC_URL, {
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
        console.warn(`[TxStreamer] RPC flush failed:`, e.message);
      }
    }

    if (!swaps.length) return;

    // Price each swap in USD from its own SOL/token ratio (per-trade price, not
    // a periodic poll) so the frontend can tick the live price on every trade.
    const solPrice = this.solPriceGetter?.();
    if (solPrice > 0) {
      for (const swap of swaps) {
        if (swap.tokenAmount > 0 && swap.solAmount > 0) {
          swap.priceUsd = (swap.solAmount / swap.tokenAmount) * solPrice;
        }
      }
    }

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
    if (stream.maxWaitTimer) {
      clearTimeout(stream.maxWaitTimer);
      stream.maxWaitTimer = null;
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
